import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 从 news-sync-service 目录加载 .env */
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量: ${name}`);
  return v;
}

function splitComma(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export type AppConfig = {
  gatewayLoginUrl: string;
  gatewayQueryUrl: string;
  gatewayUsername: string;
  gatewayPassword: string;
  mediaTypes: string[];
  mediaLevels: string[];
  syncDays: number;
  pageSize: number;
  maxPages: number;
  cozeToken: string;
  cozeDatasetId: string;
  cozeApiBase: string;
};

export function loadConfig(): AppConfig {
  return {
    gatewayLoginUrl: req('GATEWAY_LOGIN_URL'),
    gatewayQueryUrl: req('GATEWAY_QUERY_URL'),
    gatewayUsername: req('GATEWAY_USERNAME'),
    gatewayPassword: req('GATEWAY_PASSWORD'),

    mediaTypes: splitComma(process.env.MEDIA_TYPES || '融媒APP'),
    mediaLevels: splitComma(process.env.MEDIA_LEVELS || '徐汇区'),

    syncDays: Math.max(1, parseInt(process.env.SYNC_DAYS || '1', 10) || 1),
    pageSize: Math.min(100, Math.max(1, parseInt(process.env.PAGE_SIZE || '50', 10) || 50)),
    maxPages: Math.min(500, Math.max(1, parseInt(process.env.MAX_PAGES || '50', 10) || 50)),

    cozeToken: req('COZE_API_TOKEN'),
    cozeDatasetId: req('COZE_DATASET_ID'),
    cozeApiBase: process.env.COZE_API_BASE || 'https://api.coze.cn',
  };
}
