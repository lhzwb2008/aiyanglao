/**
 * 拉取融媒 API → 按稿件 ID 去重 → 增量上传新稿到 Coze 知识库
 * 接口必须传 beginAt/endAt，无法一次「全历史」；时间窗与上次重叠无妨，靠 synced_ids 去重。
 * 改执行频率只需改 crontab；可配合 SYNC_DAYS 控制单次查询跨度。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type AppConfig } from './env.js';
import { htmlToPlainText } from './htmlToText.js';
import { uploadTextDocument } from './cozeDataset.js';
import { NEWS_CHUNK_SEPARATOR } from './newsChunk.js';
import { appendSyncedIds, loadSyncedIdSet } from './syncedIds.js';
import {
  formatDateTime,
  gatewayLogin,
  queryManuscripts,
  type ManuscriptItem,
} from './manuscriptGateway.js';

function buildIncrementalDocName(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `融媒增量-${y}${m}${day}-${hh}${mm}${ss}.txt`;
}

/** 标题单行化，避免破坏「\n\n## 」分段边界 */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function buildArticleBlock(it: ManuscriptItem): string {
  const title = oneLine(it.title || '(无标题)');
  const summary = it.analysis?.summary?.trim() || '';
  const tags = (it.analysis?.tags || []).join(', ');
  const body = htmlToPlainText(it.content || '');

  const lines: string[] = [
    `## ${title}`,
    `- 稿件ID: ${it.id}`,
    `- 发布时间: ${it.publishAt}`,
  ];
  if (it.source) lines.push(`- 栏目: ${it.source}`);
  if (it.sourceName) lines.push(`- 来源: ${it.sourceName}`);
  if (it.analysis?.classification) lines.push(`- 分类: ${it.analysis.classification}`);
  if (tags) lines.push(`- 标签: ${tags}`);
  if (it.url) lines.push(`- 链接: ${it.url}`);
  lines.push('');
  if (summary) {
    lines.push('摘要:');
    lines.push(summary);
    lines.push('');
  }
  lines.push('正文:');
  lines.push(body || '(无正文)');
  return lines.join('\n');
}

function buildCorpus(items: ManuscriptItem[]): string {
  const preamble = `【融媒增量】生成时间 ${formatDateTime(new Date())} | 条数 ${items.length}`;
  const blocks = [preamble, ...items.map(buildArticleBlock)];
  return blocks.join(NEWS_CHUNK_SEPARATOR);
}

export type RunSyncOptions = {
  /**
   * full_window：始终按 SYNC_DAYS + 当天 23:59 截止（用于 purge 后全量重拉）。
   * default：若本地从未同步过且未禁用 FIRST_SYNC_TODAY_ONLY，则首次为「今日 00:00 ~ 当前时间」。
   */
  range?: 'default' | 'full_window';
};

async function fetchAllPages(
  config: AppConfig,
  firstTodayOnly: boolean
): Promise<ManuscriptItem[]> {
  let end: Date;
  let start: Date;

  if (firstTodayOnly) {
    end = new Date();
    start = new Date();
    start.setHours(0, 0, 0, 0);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
    start = new Date(end);
    start.setDate(start.getDate() - (config.syncDays - 1));
    start.setHours(0, 0, 0, 0);
  }

  const beginAt = formatDateTime(start);
  const endAt = formatDateTime(end);

  if (firstTodayOnly) {
    console.log(
      `时间范围: ${beginAt} ~ ${endAt}（首次同步：今日 00:00 ~ 当前时间；重复 ID 不会上传）`
    );
  } else {
    console.log(
      `时间范围: ${beginAt} ~ ${endAt}（最近 ${config.syncDays} 个自然日至今天 23:59；重复 ID 不会上传）`
    );
  }
  if (config.queryMode === 'street') {
    console.log(`查询模式: 按街镇 locations=${config.locations}`);
  } else {
    const lv =
      config.mediaLevels.length > 0
        ? JSON.stringify(config.mediaLevels)
        : '（未设，不按 mediaLevels 筛选）';
    console.log(
      `查询模式: 按区 mediaType=${JSON.stringify(config.mediaTypes)} mediaLevels=${lv}`
    );
  }

  const token = await gatewayLogin(
    config.gatewayLoginUrl,
    config.gatewayUsername,
    config.gatewayPassword
  );

  const collected: ManuscriptItem[] = [];
  let page = 1;
  let totalPages = 1;

  for (;;) {
    const data = await queryManuscripts({
      queryUrl: config.gatewayQueryUrl,
      token,
      beginAt,
      endAt,
      page,
      size: config.pageSize,
      queryMode: config.queryMode,
      mediaTypes: config.mediaTypes,
      mediaLevels: config.mediaLevels,
      locations: config.locations,
    });

    const batch = data?.data || [];
    collected.push(...batch);

    const total = data?.total != null ? Number(data.total) : collected.length;
    const size = data?.size ?? config.pageSize;
    totalPages = Math.ceil(total / size) || 1;

    console.log(`第 ${page}/${totalPages} 页，本页 ${batch.length} 条，累计 ${collected.length}`);

    if (batch.length === 0 || page >= totalPages) break;
    page += 1;
    if (page > config.maxPages) {
      console.warn(`已达 MAX_PAGES=${config.maxPages}，停止拉取`);
      break;
    }
  }

  return collected;
}

export async function runSync(opts?: RunSyncOptions): Promise<void> {
  const config = loadConfig();
  const synced = loadSyncedIdSet();
  console.log(`本地已记录已同步稿件数: ${synced.size}`);

  const firstTodayEnabled = (process.env.FIRST_SYNC_TODAY_ONLY ?? '1') !== '0';
  const useFirstToday =
    opts?.range !== 'full_window' &&
    synced.size === 0 &&
    firstTodayEnabled;

  if (useFirstToday) {
    console.log('首次同步：使用时间窗「今日 00:00 ~ 当前时间」（可在 .env 设 FIRST_SYNC_TODAY_ONLY=0 改为直接按 SYNC_DAYS）');
  }

  console.log('开始拉取融媒稿件…');
  const items = await fetchAllPages(config, useFirstToday);
  if (items.length === 0) {
    console.log(
      '【未写入知识库】融媒接口在本时间窗内返回 0 条稿件，已跳过上传（不是 Coze 报错）。'
    );
    console.log(
      '请检查：1）.env 中 SYNC_DAYS 是否过小，可改为 30/90/365 扩大时间窗；2）MEDIA_TYPES、MEDIA_LEVELS、QUERY_MODE 是否与网关实际枚举一致。'
    );
    return;
  }

  const newItems = items.filter((it) => !synced.has(it.id));
  console.log(`本次拉取 ${items.length} 条，其中未同步过的新稿 ${newItems.length} 条`);

  if (newItems.length === 0) {
    console.log('无新增稿件，跳过上传。');
    return;
  }

  const corpus = buildCorpus(newItems);
  const docName = buildIncrementalDocName();

  console.log(`上传到 Coze 知识库 dataset=${config.cozeDatasetId}，文件 ${docName}`);
  const uploaded = await uploadTextDocument({
    datasetId: config.cozeDatasetId,
    fileName: docName,
    text: corpus,
  });
  const u0 = uploaded[0];
  console.log('上传完成:', {
    name: u0?.name,
    document_id: u0?.document_id,
    status: u0?.status,
    size: u0?.size,
    slice_count: u0?.slice_count,
    char_count: u0?.char_count,
  });
  if (!u0?.document_id) {
    throw new Error('Coze 未返回 document_id，请检查令牌与 dataset 权限');
  }

  appendSyncedIds(newItems.map((i) => i.id));
  console.log(`已记录 ${newItems.length} 个稿件 ID 到 data/synced_ids.json`);
}

const __filename = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  runSync().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
