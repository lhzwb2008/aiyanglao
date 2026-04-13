import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CRON_MARKER = '# aiyanglao-news-sync-service';

/**
 * 若当前用户 crontab 中尚无指向本目录 run-cron.sh 的行，则追加一条。
 * @returns 是否新写入
 */
export function installCronIfNeeded(schedule: string): boolean {
  const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const runCronSh = path.join(pkgRoot, 'run-cron.sh');
  if (!fs.existsSync(runCronSh)) {
    throw new Error(`未找到 ${runCronSh}`);
  }

  const cronLine = `${schedule} /bin/bash ${runCronSh}`;

  let current = '';
  try {
    current = execSync('crontab -l', { encoding: 'utf-8' });
  } catch {
    current = '';
  }

  if (current.includes(runCronSh)) {
    console.log('[cron] 已存在指向本目录 run-cron.sh 的任务，跳过安装。');
    return false;
  }

  const block = `\n${CRON_MARKER}\n${cronLine}\n`;
  const newCrontab = (current.trimEnd() + block).trim() + '\n';
  execSync('crontab -', { input: newCrontab, encoding: 'utf-8' });
  console.log(`[cron] 已添加定时任务: ${cronLine}`);
  return true;
}
