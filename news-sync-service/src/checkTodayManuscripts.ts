/**
 * 查询「上海时区今日 00:00 ~ 当前时间」融媒稿件数量及样例（与 sync 相同筛选条件）。
 * 用法：cd news-sync-service && npx tsx src/checkTodayManuscripts.ts
 */
import { loadConfig } from './env.js';
import {
  formatDateTime,
  gatewayLogin,
  queryManuscripts,
  type ManuscriptItem,
} from './manuscriptGateway.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const beginAt = formatDateTime(start);
  const endAt = formatDateTime(end);

  console.log(`时区 TZ=${process.env.TZ || '(未设)'}`);
  console.log(`查询窗口: ${beginAt} ~ ${endAt}`);
  console.log(
    `模式: ${config.queryMode} mediaType=${JSON.stringify(config.mediaTypes)} mediaLevels=${JSON.stringify(config.mediaLevels)}`
  );

  const token = await gatewayLogin(
    config.gatewayLoginUrl,
    config.gatewayUsername,
    config.gatewayPassword
  );

  const data = await queryManuscripts({
    queryUrl: config.gatewayQueryUrl,
    token,
    beginAt,
    endAt,
    page: 1,
    size: 10,
    queryMode: config.queryMode,
    mediaTypes: config.mediaTypes,
    mediaLevels: config.mediaLevels,
    locations: config.locations,
  });

  const total = data?.total != null ? Number(data.total) : 0;
  const rows = (data?.data || []) as ManuscriptItem[];

  console.log(`\n接口返回 total=${total}，本页条数=${rows.length}`);

  if (rows.length === 0) {
    console.log('结论：该时间窗内无稿件（或筛选条件过严）。');
    return;
  }

  console.log('\n前几条样例（标题 + 发布时间）：');
  rows.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. [${r.publishAt}] ${(r.title || '').slice(0, 60)}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
