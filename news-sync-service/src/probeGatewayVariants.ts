/**
 * 探测融媒 query 在不同参数下的 total（用于确认枚举/类型）。
 * 用法：cd news-sync-service && npx tsx src/probeGatewayVariants.ts
 */
import axios from 'axios';
import { loadConfig } from './env.js';
import { formatDateTime, gatewayLogin } from './manuscriptGateway.js';

async function main(): Promise<void> {
  const c = loadConfig();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(c.syncDays - 1, 0));
  start.setHours(0, 0, 0, 0);
  const beginAt = formatDateTime(start);
  const endAt = formatDateTime(end);

  const token = await gatewayLogin(
    c.gatewayLoginUrl,
    c.gatewayUsername,
    c.gatewayPassword
  );

  const base = {
    beginAt,
    endAt,
    orderBy: 'publishAt' as const,
    size: 10,
    page: 1,
  };

  const variants: { label: string; body: Record<string, unknown> }[] = [
    { label: '仅时间窗（无 media 筛选）', body: { ...base } },
    {
      label: 'mediaType/mediaLevels 为字符串',
      body: {
        ...base,
        mediaType: '融媒APP',
        mediaLevels: '上海市',
      },
    },
    {
      label: 'mediaType/mediaLevels 为数组（当前实现）',
      body: {
        ...base,
        mediaType: ['融媒APP'],
        mediaLevels: ['上海市'],
      },
    },
    {
      label: 'mediaLevels 仅「上海」',
      body: {
        ...base,
        mediaType: ['融媒APP'],
        mediaLevels: ['上海'],
      },
    },
  ];

  for (const { label, body } of variants) {
    try {
      const { data } = await axios.post(c.gatewayQueryUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: 120000,
      });
      const inner = data?.data;
      const total = inner?.total;
      const len = Array.isArray(inner?.data) ? inner.data.length : 0;
      console.log(`[${label}] code=${data?.code} total=${total} 本页=${len}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[${label}] ERROR ${msg}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
