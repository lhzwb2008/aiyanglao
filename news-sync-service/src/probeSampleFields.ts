/**
 * 无筛选拉一页，打印前 3 条里的 mediaType / mediaLevels / source 等字段（字段名以实际为准）。
 */
import axios from 'axios';
import { loadConfig } from './env.js';
import { formatDateTime, gatewayLogin } from './manuscriptGateway.js';

async function main(): Promise<void> {
  const c = loadConfig();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (c.syncDays - 1));
  start.setHours(0, 0, 0, 0);

  const token = await gatewayLogin(
    c.gatewayLoginUrl,
    c.gatewayUsername,
    c.gatewayPassword
  );

  const body = {
    beginAt: formatDateTime(start),
    endAt: formatDateTime(end),
    orderBy: 'publishAt',
    size: 5,
    page: 1,
  };

  const { data } = await axios.post(c.gatewayQueryUrl, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 120000,
  });

  const rows = data?.data?.data;
  console.log('total=', data?.data?.total);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('无样本');
    return;
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    console.log(`--- 样本 ${i + 1} ---`);
    console.log(JSON.stringify(row, null, 2));
  }
}

main().catch(console.error);
