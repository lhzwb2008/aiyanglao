/**
 * 调用多智能体 Bot 并打印路由解析结果。
 * 用法：npm run coze:multi-agent -- "用户消息"
 */
import {
  cozeMultiAgentChat,
  DEFAULT_MULTI_AGENT_BOT_ID,
} from '../services/cozeMultiAgentChat.js';

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  console.error(
    `用法: npm run coze:multi-agent -- "你好"\n` +
      `环境变量: COZE_API_TOKEN（必填）, COZE_MULTI_AGENT_BOT_ID（可选，默认 ${DEFAULT_MULTI_AGENT_BOT_ID}）`
  );
  process.exit(1);
}

const userId = `cli_${Date.now()}`;

cozeMultiAgentChat
  .chatRound({ userId, userMessage: message })
  .then((r) => {
    const out = {
      chatId: r.chatId,
      conversationId: r.conversationId,
      answerMessageBotId: r.answerMessageBotId,
      primaryActiveAgentId: r.primaryActiveAgentId,
      jumpEvents: r.jumpEvents,
      sceneSnapshots: r.sceneSnapshots,
      answerPreview: r.answer?.slice(0, 500),
    };
    console.log(JSON.stringify(out, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
