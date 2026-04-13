/**
 * 删除当前 COZE_DATASET_ID 下全部知识库文件，清空本地 synced_ids，再执行一次与 sync 相同的拉取上传。
 * 需设置 CONFIRM_PURGE=1，防止误触。
 */
import { loadConfig } from './env.js';
import { deleteAllDocumentsInDataset } from './cozeDataset.js';
import { clearSyncedIds } from './syncedIds.js';
import { runSync } from './index.js';

async function main(): Promise<void> {
  if (process.env.CONFIRM_PURGE !== '1') {
    console.error(
      '拒绝执行：将删除知识库内全部文件并清空本地 synced_ids。若确认，请设置环境变量 CONFIRM_PURGE=1 后重试。'
    );
    process.exit(1);
  }

  const config = loadConfig();
  console.log(`即将清空 dataset=${config.cozeDatasetId} 中的全部文档…`);
  const n = await deleteAllDocumentsInDataset(config.cozeDatasetId);
  console.log(`知识库已清空，共删除 ${n} 个文件。`);

  clearSyncedIds();
  console.log('已清空 news-sync-service/data/synced_ids.json');

  await runSync();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
