import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const envInPackage = path.join(pkgRoot, '.env');
const envInCwd = path.resolve(process.cwd(), '.env');

/** 优先加载 news-sync-service/.env，其次当前工作目录下的 .env（兼容从别处启动） */
dotenv.config({ path: envInPackage });
dotenv.config({ path: envInCwd });

/** 未设置 TZ 时默认上海，保证「今日 00:00」与 crontab 预期一致 */
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    const hasFile = fs.existsSync(envInPackage) || fs.existsSync(envInCwd);
    const hint = hasFile
      ? `请检查 .env 中是否配置了 ${name}（勿留空）。`
      : `未找到 .env：请把本机 news-sync-service/.env 拷到服务器同目录，或复制 .env.example 为 .env 后填写。\n期望路径: ${envInPackage}`;
    throw new Error(`缺少环境变量: ${name}\n${hint}`);
  }
  return v;
}

function splitComma(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export type QueryMode = 'district' | 'street';

export type AppConfig = {
  gatewayLoginUrl: string;
  gatewayQueryUrl: string;
  gatewayUsername: string;
  gatewayPassword: string;
  /** district：按区+渠道（mediaType+mediaLevels）；street：按街镇（locations） */
  queryMode: QueryMode;
  mediaTypes: string[];
  mediaLevels: string[];
  /** 街镇名称，仅 queryMode=street 时必填，如 广中路街道 */
  locations: string;
  /** 每次请求拉「最近几个自然日」到「今天 23:59」；与上次时间窗重叠无妨，上传前按稿件 ID 去重 */
  syncDays: number;
  pageSize: number;
  maxPages: number;
  cozeToken: string;
  cozeDatasetId: string;
  cozeApiBase: string;
  /**
   * 知识库自定义分段：在分隔符切开后，单段仍受 max_tokens 限制；过小会在「单篇内」再切，表现为有的整篇、有的碎段。
   * 默认拉高以减少篇内二次切分（若扣子接口报错可改小）。
   */
  chunkMaxTokens: number;
  /** auto：chunk_type=1（自动分段+清洗，对齐控制台「自动分段与清洗」）；custom：chunk_type=0 纯自定义分隔符 */
  cozeChunkMode: 'auto' | 'custom';
};

export function loadConfig(): AppConfig {
  const modeRaw = (process.env.QUERY_MODE || 'district').toLowerCase();
  const queryMode: QueryMode = modeRaw === 'street' ? 'street' : 'district';
  const locations = (process.env.LOCATIONS || '').trim();

  if (queryMode === 'street' && !locations) {
    throw new Error('QUERY_MODE=street 时必须配置 LOCATIONS（街镇名称，如 广中路街道）');
  }

  return {
    gatewayLoginUrl: req('GATEWAY_LOGIN_URL'),
    gatewayQueryUrl: req('GATEWAY_QUERY_URL'),
    gatewayUsername: req('GATEWAY_USERNAME'),
    gatewayPassword: req('GATEWAY_PASSWORD'),

    queryMode,
    mediaTypes: splitComma(process.env.MEDIA_TYPES || '融媒APP'),
    /** 留空表示不按 mediaLevels 筛选。勿默认填「上海市」：与融媒 APP 组合时接口常返回 0 条（交集为空）。 */
    mediaLevels: splitComma(process.env.MEDIA_LEVELS ?? ''),
    locations,

    syncDays: Math.max(1, parseInt(process.env.SYNC_DAYS || '7', 10) || 7),
    pageSize: Math.min(100, Math.max(1, parseInt(process.env.PAGE_SIZE || '50', 10) || 50)),
    maxPages: Math.min(500, Math.max(1, parseInt(process.env.MAX_PAGES || '50', 10) || 50)),

    cozeToken: req('COZE_API_TOKEN'),
    cozeDatasetId: req('COZE_DATASET_ID'),
    cozeApiBase: process.env.COZE_API_BASE || 'https://api.coze.cn',

    chunkMaxTokens: (() => {
      const raw = parseInt(process.env.CHUNK_MAX_TOKENS || '5000', 10);
      const n = Number.isFinite(raw) && raw > 0 ? raw : 5000;
      return Math.min(200000, Math.max(512, n));
    })(),

    cozeChunkMode: (process.env.COZE_CHUNK_MODE || 'auto').toLowerCase() === 'custom' ? 'custom' : 'auto',
  };
}

/** crontab 五段式，默认每天 8:00（上海业务常见）；仅 setup 脚本使用 */
export function getCronSchedule(): string {
  return (process.env.CRON_SCHEDULE || '0 8 * * *').trim();
}
