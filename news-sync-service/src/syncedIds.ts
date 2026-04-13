import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, '..', 'data', 'synced_ids.json');

type Store = { ids: string[] };

function readStore(): Store {
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const j = JSON.parse(raw) as Store;
    if (!Array.isArray(j.ids)) return { ids: [] };
    return { ids: j.ids };
  } catch {
    return { ids: [] };
  }
}

export function loadSyncedIdSet(): Set<string> {
  return new Set(readStore().ids);
}

export function appendSyncedIds(newIds: string[]): void {
  if (newIds.length === 0) return;
  const cur = readStore();
  const merged = [...new Set([...cur.ids, ...newIds])];
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify({ ids: merged }, null, 0), 'utf-8');
}

/** 清空本地已同步稿件记录（与清空知识库配合做全量重拉） */
export function clearSyncedIds(): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify({ ids: [] }, null, 0), 'utf-8');
}
