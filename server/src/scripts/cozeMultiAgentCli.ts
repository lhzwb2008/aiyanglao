/**
 * 流式调用多智能体 Bot：stderr 输出 Thinking，stdout 流式输出最终回复；末尾 stderr 打印路由摘要。
 * 用法：
 *   npm run coze:multi-agent -- "用户消息"
 *   npm run coze:multi-agent -- --legacy "用户消息"   # 非流式 + JSON（旧行为）
 */
import {
  cozeMultiAgentChat,
  DEFAULT_MULTI_AGENT_BOT_ID,
} from '../services/cozeMultiAgentChat.js';

const args = process.argv.slice(2);
const legacy = args.includes('--legacy');
const message = args.filter((a) => a !== '--legacy').join(' ').trim();

if (!message) {
  console.error(
    `用法: npm run coze:multi-agent -- "你好"\n` +
      `       npm run coze:multi-agent -- --legacy "你好"  # 阻塞轮询 + 仅 JSON\n` +
      `环境变量: COZE_API_TOKEN（必填）, COZE_MULTI_AGENT_BOT_ID（可选，默认 ${DEFAULT_MULTI_AGENT_BOT_ID}）\n` +
      `说明: 默认流式模式 — Thinking 走 stderr，正文走 stdout，便于: npm run coze:multi-agent -- "问" | pbcopy`
  );
  process.exit(1);
}

const userId = `cli_${Date.now()}`;

async function main() {
  if (legacy) {
    const r = await cozeMultiAgentChat.chatRound({ userId, userMessage: message });
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
    return;
  }

  let thinkingStarted = false;

  const r = await cozeMultiAgentChat.chatRoundStream({
    userId,
    userMessage: message,
    handlers: {
      onReasoningDelta(chunk) {
        if (!thinkingStarted) {
          process.stderr.write('\n\x1b[36m━━ Thinking ━━\x1b[0m\n');
          thinkingStarted = true;
        }
        process.stderr.write(chunk);
      },
      onAnswerDelta(chunk) {
        process.stdout.write(chunk);
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
      '\x1b[36m━━ Thinking（流式未分片时由消息列表补全）━━\x1b[0m\n'
    );
    process.stderr.write(r.reasoningContent);
    process.stderr.write('\n');
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
