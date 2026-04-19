/**
 * 将当前 Coze 账号下各工作空间中的智能体「人设与回复逻辑」prompt（及开场白）导出到本地目录。
 * 使用开放平台 PAT：与知识库无关，仅调用 workspaces / bots 接口。
 *
 * 用法（在 news-sync-service 目录）：
 *   npm run export-prompts
 *
 * 环境变量：
 *   COZE_API_TOKEN   必填，https://www.coze.cn/open/oauth/pats
 *   COZE_API_BASE    可选，默认 https://api.coze.cn
 *   COZE_PROMPTS_EXPORT_DIR  可选，导出根目录；默认仓库根目录下 coze-prompts-export
 *
 * PAT 权限：除对话类外，需勾选与「智能体 / Bot」相关的接口权限（含列出与查看配置），
 * 否则 listNew / retrieveNew 可能返回 4101（如 listBot permission denied）。
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CozeAPI, COZE_CN_BASE_URL } from '@coze/api';

/** 列表接口字段略有差异，导出流程统一成此结构 */
type BotSummary = {
  id: string;
  name: string;
  is_published: boolean;
  updated_at?: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const repoRoot = path.join(pkgRoot, '..');

for (const p of [
  path.join(pkgRoot, '.env'),
  path.join(repoRoot, 'server', '.env'),
  path.join(repoRoot, '.env'),
  path.resolve(process.cwd(), '.env'),
]) {
  dotenv.config({ path: p });
}

function requireToken(): string {
  const t = process.env.COZE_API_TOKEN?.trim();
  if (!t) {
    throw new Error(
      '缺少 COZE_API_TOKEN。请在 news-sync-service/.env 或 server/.env 中配置 PAT。'
    );
  }
  return t;
}

function resolveBaseURL(): string {
  const b = process.env.COZE_API_BASE || 'https://api.coze.cn';
  return b === 'https://api.coze.cn' ? COZE_CN_BASE_URL : b;
}

function resolveOutDir(): string {
  if (process.env.COZE_PROMPTS_EXPORT_DIR?.trim()) {
    return path.resolve(process.env.COZE_PROMPTS_EXPORT_DIR.trim());
  }
  return path.join(repoRoot, 'coze-prompts-export');
}

function sanitizeSegment(s: string): string {
  return s
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'unnamed';
}

async function listAllWorkspaces(client: CozeAPI): Promise<{ id: string; name: string }[]> {
  const pageSize = 50;
  const out: { id: string; name: string }[] = [];
  let page = 1;
  while (true) {
    const res = await client.workspaces.list({ page_num: page, page_size: pageSize });
    const ws = res.workspaces ?? [];
    if (ws.length === 0) break;
    for (const w of ws) {
      out.push({ id: w.id, name: w.name });
    }
    if (ws.length < pageSize) break;
    if (out.length >= (res.total_count ?? 0) && (res.total_count ?? 0) > 0) break;
    page += 1;
    if (page > 500) break;
  }
  return out;
}

function isListBotPermissionDenied(e: unknown): boolean {
  const any = e as { code?: number; msg?: string };
  return any?.code === 4101 || String(any?.msg || '').includes('listBot');
}

/** 新接口：含草稿/已发布等全量（需 PAT 含 listBot） */
async function listBotsViaListNew(
  client: CozeAPI,
  workspaceId: string
): Promise<BotSummary[]> {
  const pageSize = 50;
  const out: BotSummary[] = [];
  let page = 1;
  while (true) {
    const res = await client.bots.listNew({
      workspace_id: workspaceId,
      publish_status: 'all',
      page_size: pageSize,
      page_num: page,
    });
    const items = res.items ?? [];
    if (items.length === 0) break;
    for (const b of items) {
      out.push({
        id: b.id,
        name: b.name,
        is_published: b.is_published,
        updated_at: b.updated_at,
      });
    }
    if (out.length >= res.total) break;
    if (items.length < pageSize) break;
    page += 1;
    if (page > 5000) break;
  }
  return out;
}

/**
 * 旧接口 published_bots_list：仅「已发布为 API 服务」的智能体，权限集合可能与新接口不同。
 * 在 listNew 报 4101 时作为后备。
 */
async function listBotsViaLegacyPublishedList(
  client: CozeAPI,
  spaceId: string
): Promise<BotSummary[]> {
  const pageSize = 50;
  const out: BotSummary[] = [];
  let pageIndex = 1;
  while (true) {
    const res = await client.bots.list({
      space_id: spaceId,
      page_size: pageSize,
      page_index: pageIndex,
    });
    const bots = res.space_bots ?? [];
    if (bots.length === 0) break;
    for (const s of bots) {
      const t = parseInt(String(s.publish_time || '0'), 10);
      out.push({
        id: s.bot_id,
        name: s.bot_name,
        is_published: true,
        updated_at: Number.isFinite(t) && t > 0 ? t : undefined,
      });
    }
    if (out.length >= res.total) break;
    if (bots.length < pageSize) break;
    pageIndex += 1;
    if (pageIndex > 5000) break;
  }
  return out;
}

async function listAllBotsInSpace(client: CozeAPI, workspaceId: string): Promise<BotSummary[]> {
  try {
    return await listBotsViaListNew(client, workspaceId);
  } catch (e) {
    if (!isListBotPermissionDenied(e)) throw e;
    console.warn(
      `  [${workspaceId}] listNew 无 listBot 权限，改用 bots.list（仅含已发布为 API 的智能体）…`
    );
    return listBotsViaLegacyPublishedList(client, workspaceId);
  }
}

async function main(): Promise<void> {
  const outDir = resolveOutDir();
  fs.mkdirSync(outDir, { recursive: true });

  const client = new CozeAPI({
    token: requireToken(),
    baseURL: resolveBaseURL(),
  });

  console.log(`导出目录: ${outDir}`);

  const spaces = await listAllWorkspaces(client);
  console.log(`工作空间数量: ${spaces.length}`);
  if (spaces.length === 0) {
    console.warn('未找到任何工作空间，请确认 PAT 权限与账号。');
    return;
  }

  const manifest: {
    exported_at: string;
    spaces: {
      id: string;
      name: string;
      bot_count: number;
      dir: string;
      error?: string;
    }[];
  } = { exported_at: new Date().toISOString(), spaces: [] };

  for (const space of spaces) {
    const dirName = `${sanitizeSegment(space.name)}__${space.id}`;
    const spaceDir = path.join(outDir, dirName);
    fs.mkdirSync(spaceDir, { recursive: true });

    let bots: BotSummary[];
    try {
      bots = await listAllBotsInSpace(client, space.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [${space.name}] 列出智能体失败: ${msg}`);
      manifest.spaces.push({
        id: space.id,
        name: space.name,
        bot_count: 0,
        dir: dirName,
        error: msg,
      });
      continue;
    }

    console.log(`  [${space.name}] 智能体: ${bots.length}`);

    for (const b of bots) {
      let detail;
      try {
        detail = await client.bots.retrieveNew(b.id, { is_published: b.is_published });
      } catch (e) {
        console.warn(`    跳过 ${b.id} (${b.name}): retrieve 失败`, e);
        continue;
      }

      const prompt = detail.prompt_info?.prompt ?? '';
      const prologue = detail.onboarding_info?.prologue ?? '';
      const suggested = detail.onboarding_info?.suggested_questions ?? [];

      const fileBase = `${b.id}_${sanitizeSegment(b.name)}`;
      const md =
        `# ${detail.name}\n\n` +
        `- **bot_id**: ${detail.bot_id}\n` +
        `- **workspace**: ${space.name} (${space.id})\n` +
        `- **is_published**: ${b.is_published}\n` +
        `- **updated_at** (list): ${b.updated_at ?? '—'}\n` +
        `- **version**: ${detail.version ?? ''}\n\n` +
        `## 人设与回复逻辑（prompt）\n\n` +
        `${prompt}\n\n` +
        `## 开场白\n\n` +
        `${prologue}\n\n` +
        (suggested.length
          ? `## 推荐问题\n\n${suggested.map((q) => `- ${q}`).join('\n')}\n`
          : '');

      fs.writeFileSync(path.join(spaceDir, `${fileBase}.md`), md, 'utf8');
    }

    manifest.spaces.push({
      id: space.id,
      name: space.name,
      bot_count: bots.length,
      dir: dirName,
    });
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log('完成。汇总见 manifest.json');
}

function printFriendlyHint(e: unknown): void {
  const any = e as { code?: number; msg?: string };
  if (any?.code === 4101 || String(any?.msg || '').includes('listBot')) {
    console.error(
      '\n提示：当前 PAT 缺少「列出/查看智能体」相关权限。请打开 https://www.coze.cn/open/oauth/pats ' +
        '编辑该令牌，勾选 Bot / 智能体管理类权限后重试。\n'
    );
  }
}

main().catch((e) => {
  printFriendlyHint(e);
  console.error(e);
  process.exit(1);
});
