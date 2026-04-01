import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const COZE_API_BASE = 'https://api.coze.cn';

/** 入口多智能体（父 Bot）ID，可通过环境变量覆盖 */
export const DEFAULT_MULTI_AGENT_BOT_ID = '7602083872843038754';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CozeChatMessage {
  id?: string;
  type?: string;
  role?: string;
  bot_id?: string;
  content?: string;
  content_type?: string;
  created_at?: number;
  reasoning_content?: string;
  [key: string]: unknown;
}

/** verbose → msg_type === multi_agents_jump_to_agent 解析结果 */
export interface CozeMultiAgentJumpEvent {
  method: string;
  agentId: string;
  agentName?: string;
  condition?: string;
  arguments?: string;
  intentMode?: boolean;
  intentStage?: string;
  /** 原始 verbose 消息 id，便于与 answer 时间线对齐 */
  messageId?: string;
  createdAt?: number;
}

/** 从 knowledge_recall 里读到的 scene 上下文（该轮实际推理所用智能体） */
export interface CozeSceneContextSnapshot {
  entryBotId?: string;
  /** 子智能体 / 当前执行节点 ID，与 jump 的 agent_id 一致 */
  activeAgentId?: string;
  botName?: string;
  messageId?: string;
  createdAt?: number;
}

export interface CozeChatRoundResult {
  chatId: string;
  conversationId: string;
  status: string;
  answer?: string;
  reasoningContent?: string;
  /** 顶层 answer 消息上的 bot_id（通常为入口父 Bot） */
  answerMessageBotId?: string;
  /** 综合 jump + knowledge_recall 推断的当前执行智能体 ID */
  primaryActiveAgentId?: string;
  messages: CozeChatMessage[];
  /** 多智能体跳转事件（按时间顺序） */
  jumpEvents: CozeMultiAgentJumpEvent[];
  /** knowledge_recall 中的 scene 快照（通常每条用户轮次 0～1 条有效） */
  sceneSnapshots: CozeSceneContextSnapshot[];
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 从单条 v3/chat/message/list 的 verbose 解析跳转与场景信息。
 * 文档参考：查看对话 / 消息列表（与 retrieve 配合使用）
 * https://www.coze.cn/open/docs/developer_guides/retrieve_chat
 */
export function parseVerboseForRouting(msg: CozeChatMessage): {
  jump?: CozeMultiAgentJumpEvent;
  scene?: CozeSceneContextSnapshot;
} {
  if (msg.type !== 'verbose' || typeof msg.content !== 'string') {
    return {};
  }

  const outer = safeJsonParse<{
    msg_type?: string;
    data?: string | Record<string, unknown>;
  }>(msg.content);
  if (!outer?.msg_type) {
    return {};
  }

  const baseMeta = {
    messageId: typeof msg.id === 'string' ? msg.id : undefined,
    createdAt: typeof msg.created_at === 'number' ? msg.created_at : undefined,
  };

  if (outer.msg_type === 'multi_agents_jump_to_agent' && typeof outer.data === 'string') {
    const payload = safeJsonParse<{
      method?: string;
      agent_id?: string;
      agent_name?: string;
      condition?: string;
      arguments?: string;
      intent_mode?: boolean;
      intent_stage?: string;
    }>(outer.data);
    if (payload?.agent_id) {
      return {
        jump: {
          method: payload.method || 'multi_agents_jump_to_agent',
          agentId: String(payload.agent_id),
          agentName: payload.agent_name,
          condition: payload.condition,
          arguments: payload.arguments,
          intentMode: payload.intent_mode,
          intentStage: payload.intent_stage,
          ...baseMeta,
        },
      };
    }
  }

  if (outer.msg_type === 'knowledge_recall' && typeof outer.data === 'string') {
    const inner = safeJsonParse<{ ori_req?: string | Record<string, unknown> }>(outer.data);
    if (!inner?.ori_req) {
      return {};
    }
    const oriReq =
      typeof inner.ori_req === 'string'
        ? safeJsonParse<{ scene_context?: Record<string, string> }>(inner.ori_req)
        : (inner.ori_req as { scene_context?: Record<string, string> });
    const sc = oriReq?.scene_context;
    if (!sc) {
      return {};
    }
    return {
      scene: {
        entryBotId: sc.bot_id,
        activeAgentId: sc.agent_id,
        botName: sc.bot_name,
        ...baseMeta,
      },
    };
  }

  return {};
}

/** 对一轮 chat 返回的消息列表做汇总 */
export function summarizeRoutingFromMessages(messages: CozeChatMessage[]): {
  jumpEvents: CozeMultiAgentJumpEvent[];
  sceneSnapshots: CozeSceneContextSnapshot[];
  primaryActiveAgentId?: string;
} {
  const ordered = [...messages].sort(
    (a, b) => (a.created_at ?? 0) - (b.created_at ?? 0)
  );

  const jumpEvents: CozeMultiAgentJumpEvent[] = [];
  const sceneSnapshots: CozeSceneContextSnapshot[] = [];

  for (const m of ordered) {
    const { jump, scene } = parseVerboseForRouting(m);
    if (jump) {
      jumpEvents.push(jump);
    }
    if (scene?.activeAgentId || scene?.entryBotId) {
      sceneSnapshots.push(scene);
    }
  }

  const lastScene = sceneSnapshots[sceneSnapshots.length - 1];
  const lastJump = jumpEvents[jumpEvents.length - 1];

  const primaryActiveAgentId =
    lastScene?.activeAgentId ??
    lastJump?.agentId ??
    undefined;

  return { jumpEvents, sceneSnapshots, primaryActiveAgentId };
}

function primaryAgentFromRouting(
  jumpEvents: CozeMultiAgentJumpEvent[],
  sceneSnapshots: CozeSceneContextSnapshot[]
): string | undefined {
  const lastScene = sceneSnapshots[sceneSnapshots.length - 1];
  const lastJump = jumpEvents[jumpEvents.length - 1];
  return lastScene?.activeAgentId ?? lastJump?.agentId;
}

export interface CozeStreamHandlers {
  /** 模型 thinking / reasoning 增量 */
  onReasoningDelta?: (chunk: string) => void;
  /** 最终回复正文增量 */
  onAnswerDelta?: (chunk: string) => void;
  onJump?: (jump: CozeMultiAgentJumpEvent) => void;
  onScene?: (scene: CozeSceneContextSnapshot) => void;
}

/** 用户变量写入项，对应控制台「用户变量」keyword（如 credits） */
export interface CozeUserVariableEntry {
  keyword: string;
  value: string;
}

export interface CozeStreamResult {
  chatId: string;
  conversationId: string;
  status: string;
  answer: string;
  reasoningContent: string;
  usage?: Record<string, unknown>;
  lastError?: { code?: number; msg?: string };
  jumpEvents: CozeMultiAgentJumpEvent[];
  sceneSnapshots: CozeSceneContextSnapshot[];
  primaryActiveAgentId?: string;
}

async function* iterateSseEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<{ event: string; data: string }> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    for (;;) {
      const sep = buffer.indexOf('\n\n');
      if (sep < 0) {
        break;
      }
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^\s/, ''));
        }
      }
      const dataStr = dataLines.join('\n');
      if (dataStr.length > 0) {
        yield { event: eventName, data: dataStr };
      }
    }
    if (done) {
      break;
    }
  }
}

export class CozeMultiAgentChatService {
  private client: AxiosInstance;
  private defaultBotId: string;
  private token: string;

  constructor(options?: { token?: string; botId?: string }) {
    const token = options?.token ?? process.env.COZE_API_TOKEN ?? '';
    this.token = token;
    this.defaultBotId =
      options?.botId ??
      process.env.COZE_MULTI_AGENT_BOT_ID ??
      DEFAULT_MULTI_AGENT_BOT_ID;

    if (!token) {
      console.warn('COZE_API_TOKEN is not set');
    }

    this.client = axios.create({
      baseURL: COZE_API_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Agw-Js-Conv': 'str',
      },
    });

    this.client.interceptors.response.use(
      (r) => r,
      (error) => {
        console.error('Coze API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * 写入 Bot 用户变量（方案一）。connector_uid 须与本次 v3/chat 的 user_id 一致。
   * 文档：https://www.coze.cn/open/docs/developer_guides/update_variable
   */
  async updateUserVariables(params: {
    connectorUid: string;
    data: CozeUserVariableEntry[];
    botId?: string;
    /** API 渠道常见为 1024，若写入失败可设环境变量 COZE_CONNECTOR_ID */
    connectorId?: string;
  }): Promise<void> {
    if (!this.token) {
      throw new Error('COZE_API_TOKEN is not set');
    }
    if (params.data.length === 0) {
      return;
    }
    const botId = params.botId ?? this.defaultBotId;
    const connectorId =
      params.connectorId ?? process.env.COZE_CONNECTOR_ID ?? undefined;
    const body: Record<string, unknown> = {
      bot_id: botId,
      connector_uid: params.connectorUid,
      data: params.data.map((d) => ({ keyword: d.keyword, value: String(d.value) })),
    };
    if (connectorId) {
      body.connector_id = connectorId;
    }
    const res = await this.client.put('/v1/variables', body);
    const code = res.data?.code;
    if (code !== undefined && code !== 0) {
      throw new Error(
        `update variables failed: ${JSON.stringify(res.data)}`
      );
    }
  }

  /** 读取用户变量，便于调试校验写入是否生效 */
  async retrieveUserVariables(params: {
    connectorUid: string;
    keywords: string[];
    botId?: string;
    connectorId?: string;
  }): Promise<CozeUserVariableEntry[]> {
    if (!this.token) {
      throw new Error('COZE_API_TOKEN is not set');
    }
    const botId = params.botId ?? this.defaultBotId;
    const connectorId =
      params.connectorId ?? process.env.COZE_CONNECTOR_ID ?? undefined;
    const query: Record<string, string> = {
      bot_id: botId,
      connector_uid: params.connectorUid,
      keywords: params.keywords.join(','),
    };
    if (connectorId) {
      query.connector_id = connectorId;
    }
    const res = await this.client.get('/v1/variables', { params: query });
    const code = res.data?.code;
    if (code !== undefined && code !== 0) {
      throw new Error(
        `retrieve variables failed: ${JSON.stringify(res.data)}`
      );
    }
    const raw = res.data?.data;
    const items: unknown =
      raw && typeof raw === 'object' && 'items' in raw
        ? (raw as { items: unknown }).items
        : Array.isArray(raw)
          ? raw
          : [];
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return null;
        }
        const o = row as Record<string, unknown>;
        const keyword = o.keyword;
        const value = o.value;
        if (typeof keyword !== 'string') {
          return null;
        }
        return {
          keyword,
          value: typeof value === 'string' ? value : String(value ?? ''),
        };
      })
      .filter((x): x is CozeUserVariableEntry => x != null);
  }

  /**
   * 发起一轮对话并拉取消息列表。
   * 区分「跳转到哪个子 Bot」：优先看 jumpEvents；最终以 knowledge_recall 里 scene_context.agent_id 为准（与 jump 的 agent_id 在成功路由时应一致）。
   */
  async chatRound(params: {
    userId: string;
    userMessage: string;
    botId?: string;
    /** 多轮时传入上一轮返回的 conversation_id */
    conversationId?: string;
    /** 发起对话前写入用户变量（须与 userId 对应） */
    userVariables?: CozeUserVariableEntry[];
    connectorId?: string;
    pollIntervalMs?: number;
    maxPolls?: number;
  }): Promise<CozeChatRoundResult> {
    const {
      userId,
      userMessage,
      botId = this.defaultBotId,
      conversationId,
      userVariables,
      connectorId,
      pollIntervalMs = 2000,
      maxPolls = 60,
    } = params;

    if (userVariables?.length) {
      await this.updateUserVariables({
        connectorUid: userId,
        botId,
        connectorId,
        data: userVariables,
      });
    }

    const body: Record<string, unknown> = {
      bot_id: botId,
      user_id: userId,
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: userMessage,
          content_type: 'text',
        },
      ],
    };
    if (conversationId) {
      body.conversation_id = conversationId;
    }

    const chatResponse = await this.client.post('/v3/chat', body);
    const chatData = chatResponse.data?.data;
    if (!chatData?.id || !chatData?.conversation_id) {
      throw new Error('Failed to initiate chat: ' + JSON.stringify(chatResponse.data));
    }

    const chatId: string = String(chatData.id);
    const convId: string = String(chatData.conversation_id);

    let status: string = chatData.status ?? 'in_progress';
    let polls = 0;

    while (status !== 'completed' && status !== 'failed' && polls < maxPolls) {
      await sleep(pollIntervalMs);
      polls++;
      const retrieveResponse = await this.client.get('/v3/chat/retrieve', {
        params: { chat_id: chatId, conversation_id: convId },
      });
      status = retrieveResponse.data?.data?.status ?? status;
    }

    if (status !== 'completed') {
      throw new Error(`Chat did not complete, status: ${status}`);
    }

    const messagesResponse = await this.client.get('/v3/chat/message/list', {
      params: { chat_id: chatId, conversation_id: convId },
    });

    const messages: CozeChatMessage[] = messagesResponse.data?.data ?? [];
    const answerMessage = messages.find(
      (msg) => msg.type === 'answer' && msg.role === 'assistant'
    );

    const { jumpEvents, sceneSnapshots, primaryActiveAgentId } =
      summarizeRoutingFromMessages(messages);

    return {
      chatId,
      conversationId: convId,
      status,
      answer: typeof answerMessage?.content === 'string' ? answerMessage.content : undefined,
      reasoningContent:
        typeof answerMessage?.reasoning_content === 'string'
          ? answerMessage.reasoning_content
          : undefined,
      answerMessageBotId:
        typeof answerMessage?.bot_id === 'string' ? answerMessage.bot_id : undefined,
      primaryActiveAgentId,
      messages,
      jumpEvents,
      sceneSnapshots,
    };
  }

  /**
   * 流式对话（SSE）：低延迟输出 answer / reasoning 增量；verbose 完成事件用于多智能体路由。
   * 与 stream:false + 轮询 retrieve 相比，首字延迟明显更低。
   */
  async chatRoundStream(params: {
    userId: string;
    userMessage: string;
    botId?: string;
    conversationId?: string;
    userVariables?: CozeUserVariableEntry[];
    connectorId?: string;
    handlers?: CozeStreamHandlers;
  }): Promise<CozeStreamResult> {
    const {
      userId,
      userMessage,
      botId = this.defaultBotId,
      conversationId,
      userVariables,
      connectorId,
      handlers = {},
    } = params;

    if (!this.token) {
      throw new Error('COZE_API_TOKEN is not set');
    }

    if (userVariables?.length) {
      await this.updateUserVariables({
        connectorUid: userId,
        botId,
        connectorId,
        data: userVariables,
      });
    }

    const body: Record<string, unknown> = {
      bot_id: botId,
      user_id: userId,
      stream: true,
      additional_messages: [
        {
          role: 'user',
          content: userMessage,
          content_type: 'text',
        },
      ],
    };
    if (conversationId) {
      body.conversation_id = conversationId;
    }

    const res = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Agw-Js-Conv': 'str',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Coze stream HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Coze stream: empty response body');
    }

    let answer = '';
    let reasoningContent = '';
    let anyAnswerDelta = false;
    let anyReasoningDelta = false;
    const jumpEvents: CozeMultiAgentJumpEvent[] = [];
    const sceneSnapshots: CozeSceneContextSnapshot[] = [];

    let chatId = '';
    let conversationIdOut = '';
    let status = 'in_progress';
    let usage: Record<string, unknown> | undefined;
    let lastError: { code?: number; msg?: string } | undefined;

    for await (const { event, data } of iterateSseEvents(reader)) {
      if (event === 'done') {
        break;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (
        event === 'conversation.chat.created' ||
        event === 'conversation.chat.in_progress'
      ) {
        if (payload.id != null) {
          chatId = String(payload.id);
        }
        if (payload.conversation_id != null) {
          conversationIdOut = String(payload.conversation_id);
        }
      }

      if (event === 'conversation.message.delta') {
        const rc = payload.reasoning_content;
        if (typeof rc === 'string' && rc.length > 0) {
          anyReasoningDelta = true;
          reasoningContent += rc;
          handlers.onReasoningDelta?.(rc);
        }
        const ch = payload.content;
        if (typeof ch === 'string' && ch.length > 0) {
          anyAnswerDelta = true;
          answer += ch;
          handlers.onAnswerDelta?.(ch);
        }
      }

      if (event === 'conversation.message.completed') {
        const msg = payload as unknown as CozeChatMessage;
        if (msg.type === 'verbose' && typeof msg.content === 'string') {
          const { jump, scene } = parseVerboseForRouting(msg);
          if (jump) {
            jumpEvents.push(jump);
            handlers.onJump?.(jump);
          }
          if (scene && (scene.activeAgentId || scene.entryBotId)) {
            sceneSnapshots.push(scene);
            handlers.onScene?.(scene);
          }
        }
        if (msg.type === 'answer') {
          const fullR = msg.reasoning_content;
          if (
            !anyReasoningDelta &&
            typeof fullR === 'string' &&
            fullR.length > 0
          ) {
            reasoningContent = fullR;
            handlers.onReasoningDelta?.(fullR);
          }
          const fullC = msg.content;
          if (!anyAnswerDelta && typeof fullC === 'string' && fullC.length > 0) {
            answer = fullC;
            handlers.onAnswerDelta?.(fullC);
          }
        }
      }

      if (event === 'conversation.chat.completed') {
        status = String(payload.status ?? 'completed');
        if (payload.usage && typeof payload.usage === 'object') {
          usage = payload.usage as Record<string, unknown>;
        }
        if (payload.id != null) {
          chatId = String(payload.id);
        }
        if (payload.conversation_id != null) {
          conversationIdOut = String(payload.conversation_id);
        }
      }

      if (event === 'conversation.chat.failed') {
        status = 'failed';
        const err = payload.last_error as { code?: number; msg?: string } | undefined;
        lastError = err;
        throw new Error(
          `Coze chat failed: ${err?.msg ?? JSON.stringify(payload).slice(0, 300)}`
        );
      }
    }

    // 部分配置下 SSE 只推 reasoning 分片，正文 content 无增量；completed 里的 answer 也可能不带 content。
    // 此时须在流结束后用 message/list 补全文，否则会只有 Thinking、stdout 无「原文」。
    if (chatId && conversationIdOut && status === 'completed') {
      const needAnswerArchive = !answer.trim();
      const needReasoningArchive = !anyReasoningDelta;
      if (needAnswerArchive || needReasoningArchive) {
        try {
          const messagesResponse = await this.client.get('/v3/chat/message/list', {
            params: { chat_id: chatId, conversation_id: conversationIdOut },
          });
          const listMsgs: CozeChatMessage[] = messagesResponse.data?.data ?? [];
          const answerMessage = listMsgs.find(
            (msg) => msg.type === 'answer' && msg.role === 'assistant'
          );
          if (needAnswerArchive && answerMessage) {
            const fullC = answerMessage.content;
            if (typeof fullC === 'string' && fullC.trim().length > 0) {
              answer = fullC;
              handlers.onAnswerDelta?.(fullC);
            }
          }
          if (needReasoningArchive && answerMessage) {
            const fullR = answerMessage.reasoning_content;
            if (typeof fullR === 'string' && fullR.length > 0) {
              reasoningContent = fullR;
            }
          }
        } catch {
          /* 忽略补拉失败 */
        }
      }
    }

    const primaryActiveAgentId = primaryAgentFromRouting(jumpEvents, sceneSnapshots);

    return {
      chatId,
      conversationId: conversationIdOut,
      status,
      answer,
      reasoningContent,
      usage,
      lastError,
      jumpEvents,
      sceneSnapshots,
      primaryActiveAgentId,
    };
  }
}

export const cozeMultiAgentChat = new CozeMultiAgentChatService();
