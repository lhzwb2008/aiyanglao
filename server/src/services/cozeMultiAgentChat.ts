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

export class CozeMultiAgentChatService {
  private client: AxiosInstance;
  private defaultBotId: string;

  constructor(options?: { token?: string; botId?: string }) {
    const token = options?.token ?? process.env.COZE_API_TOKEN;
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
   * 发起一轮对话并拉取消息列表。
   * 区分「跳转到哪个子 Bot」：优先看 jumpEvents；最终以 knowledge_recall 里 scene_context.agent_id 为准（与 jump 的 agent_id 在成功路由时应一致）。
   */
  async chatRound(params: {
    userId: string;
    userMessage: string;
    botId?: string;
    /** 多轮时传入上一轮返回的 conversation_id */
    conversationId?: string;
    pollIntervalMs?: number;
    maxPolls?: number;
  }): Promise<CozeChatRoundResult> {
    const {
      userId,
      userMessage,
      botId = this.defaultBotId,
      conversationId,
      pollIntervalMs = 2000,
      maxPolls = 60,
    } = params;

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
}

export const cozeMultiAgentChat = new CozeMultiAgentChatService();
