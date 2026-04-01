/**
 * 流式调用多智能体 Bot：
 * - stderr：Thinking + 正式回复 + 路由等（终端里主要看这一路）。
 * - stdout：仅在「被重定向/管道」时（stdout 非 TTY）写入正式回复，避免与 stderr 双写导致屏幕上每个字重复一遍。
 * 用法：
 *   npm run coze:multi-agent -- "用户消息"
 *   npm run coze:multi-agent -- --credits 120 "请用一句话说出我的积分变量 credits 的数值"
 *   npm run coze:multi-agent -- --user my_uid_1 --credits 88 "同上"
 *   npm run coze:multi-agent -- --legacy "用户消息"
 *
 * --credits：方案一，先 PUT /v1/variables 写入用户变量 credits（与控制台 keyword 一致），再对话。
 * --user：固定 user_id / connector_uid，便于多轮或复现；默认 cli_<时间戳>。
 * 若写入失败可设 COZE_CONNECTOR_ID=1024（API 渠道常见值）。
 */
import {
  cozeMultiAgentChat,
  DEFAULT_MULTI_AGENT_BOT_ID,
} from '../services/cozeMultiAgentChat.js';

function parseCliArgs(argv: string[]) {
  let legacy = false;
  let credits: string | undefined;
  let stableUser: string | undefined;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--legacy') {
      legacy = true;
      continue;
    }
    if (a === '--credits') {
      credits = argv[++i] ?? '';
      continue;
    }
    if (a.startsWith('--credits=')) {
      credits = a.slice('--credits='.length);
      continue;
    }
    if (a === '--user') {
      stableUser = argv[++i] ?? '';
      continue;
    }
    if (a.startsWith('--user=')) {
      stableUser = a.slice('--user='.length);
      continue;
    }
    rest.push(a);
  }

  return {
    legacy,
    credits,
    stableUser,
    message: rest.join(' ').trim(),
  };
}

const { legacy, credits, stableUser, message } = parseCliArgs(
  process.argv.slice(2)
);

if (!message) {
  console.error(
    `用法: npm run coze:multi-agent -- "你好"\n` +
      `       npm run coze:multi-agent -- --credits 120 "请说出我的 credits 变量值"\n` +
      `       npm run coze:multi-agent -- --user my_uid --credits 50 "同上"\n` +
      `       npm run coze:multi-agent -- --legacy "你好"\n` +
      `环境变量: COZE_API_TOKEN（必填）, COZE_MULTI_AGENT_BOT_ID（可选，默认 ${DEFAULT_MULTI_AGENT_BOT_ID}）, COZE_CONNECTOR_ID（可选）\n` +
      `说明: 需在提示词中引用 {{credits}} 等变量，Bot 才会在回复里体现积分。\n` +
      `输出: 终端上看 stderr（Thinking/正式回复/路由）；重定向 stdout 时才会把正文写入文件，如: npm run coze:multi-agent -- "你好" > ans.txt`
  );
  process.exit(1);
}

const userId = stableUser?.trim() || `cli_${Date.now()}`;
const userVariables =
  credits !== undefined && credits !== ''
    ? [{ keyword: 'credits', value: String(credits) }]
    : undefined;

/** 正式回复：始终写 stderr；仅在被管道/重定向时同步写 stdout，避免交互式终端双通道叠字 */
function writeFormalChunk(chunk: string) {
  process.stderr.write(chunk);
  if (!process.stdout.isTTY) {
    process.stdout.write(chunk);
  }
}

async function main() {
  if (userVariables?.length) {
    process.stderr.write(
      `\x1b[2m[变量] 将写入 credits=${userVariables[0].value}（connector_uid=user_id=${userId}）\x1b[0m\n`
    );
  }

  if (legacy) {
    const r = await cozeMultiAgentChat.chatRound({
      userId,
      userMessage: message,
      userVariables,
    });
    if (r.answer) {
      process.stderr.write('\n\x1b[32m━━ 正式回复 ━━\x1b[0m\n');
      process.stderr.write(r.answer);
      process.stderr.write('\n');
      if (!process.stdout.isTTY) {
        process.stdout.write(r.answer);
        process.stdout.write('\n');
      }
    }
    console.log(
      JSON.stringify(
        {
          chatId: r.chatId,
          conversationId: r.conversationId,
          answerMessageBotId: r.answerMessageBotId,
          primaryActiveAgentId: r.primaryActiveAgentId,
          jumpEvents: r.jumpEvents,
          sceneSnapshots: r.sceneSnapshots,
          answerPreview: r.answer?.slice(0, 500),
        },
        null,
        2
      )
    );
    if (userVariables?.length) {
      try {
        const snap = await cozeMultiAgentChat.retrieveUserVariables({
          connectorUid: userId,
          keywords: ['credits'],
        });
        console.error('[变量] 对话后 GET 校验:', JSON.stringify(snap));
      } catch (e) {
        console.error('[变量] GET 校验失败:', e);
      }
    }
    return;
  }

  let thinkingStarted = false;
  let formalStarted = false;

  const r = await cozeMultiAgentChat.chatRoundStream({
    userId,
    userMessage: message,
    userVariables,
    handlers: {
      onReasoningDelta(chunk) {
        if (!thinkingStarted) {
          process.stderr.write('\n\x1b[36m━━ Thinking（推理过程）━━\x1b[0m\n');
          thinkingStarted = true;
        }
        process.stderr.write(chunk);
      },
      onAnswerDelta(chunk) {
        if (!formalStarted) {
          process.stderr.write(
            '\n\x1b[32m━━ 正式回复 ━━\x1b[0m\n'
          );
          formalStarted = true;
        }
        writeFormalChunk(chunk);
      },
      onJump(jump) {
        process.stderr.write(
          `\n\x1b[33m[跳转]\x1b[0m ${jump.agentName ?? jump.agentId} ← ${(jump.condition ?? '').slice(0, 80)}${(jump.condition?.length ?? 0) > 80 ? '…' : ''}\n`
        );
      },
    },
  });

  process.stderr.write('\n');
  if (!thinkingStarted && r.reasoningContent) {
    process.stderr.write(
      '\x1b[36m━━ Thinking（消息列表补全）━━\x1b[0m\n'
    );
    process.stderr.write(r.reasoningContent);
    process.stderr.write('\n');
  }

  if (!formalStarted && r.answer?.trim()) {
    process.stderr.write('\n\x1b[32m━━ 正式回复 ━━\x1b[0m\n');
    process.stderr.write(r.answer);
    process.stderr.write('\n');
    if (!process.stdout.isTTY) {
      process.stdout.write(r.answer);
      process.stdout.write('\n');
    }
    formalStarted = true;
  }

  process.stderr.write('\n\x1b[2m━━ 路由 / 元数据 ━━\x1b[0m\n');
  process.stderr.write(
    JSON.stringify(
      {
        chatId: r.chatId,
        conversationId: r.conversationId,
        status: r.status,
        primaryActiveAgentId: r.primaryActiveAgentId,
        jumpEvents: r.jumpEvents,
        sceneSnapshots: r.sceneSnapshots,
        usage: r.usage,
      },
      null,
      2
    )
  );
  process.stderr.write('\n');

  if (userVariables?.length) {
    try {
      const snap = await cozeMultiAgentChat.retrieveUserVariables({
        connectorUid: userId,
        keywords: ['credits'],
      });
      process.stderr.write(
        `\x1b[2m[变量] 对话后 GET 校验: ${JSON.stringify(snap)}\x1b[0m\n`
      );
    } catch (e) {
      process.stderr.write(`\x1b[33m[变量] GET 校验失败: ${e}\x1b[0m\n`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
