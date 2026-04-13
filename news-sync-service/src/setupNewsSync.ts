/**
 * 幂等安装 crontab（指向 run-cron.sh）+ 立即执行一次同步。
 */
import { getCronSchedule } from './env.js';
import { installCronIfNeeded } from './crontabInstall.js';
import { runSync } from './index.js';

async function main(): Promise<void> {
  const schedule = getCronSchedule();
  installCronIfNeeded(schedule);
  console.log('开始立即执行一次同步…');
  await runSync();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
