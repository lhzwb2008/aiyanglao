/**
 * 仅清空本地 data/synced_ids.json（不删 Coze 文档）。
 * 适用于：只在控制台/网页删了知识库文件、未跑 purge-and-resync 时，与知识库状态对齐。
 */
import { clearSyncedIds } from './syncedIds.js';

clearSyncedIds();
console.log('已清空本地已同步稿件记录：news-sync-service/data/synced_ids.json');
console.log('下次 sync 会把时间窗内拉到的稿件视为「未同步」并尝试上传（仍会去重）。');
