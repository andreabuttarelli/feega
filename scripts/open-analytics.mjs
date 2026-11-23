import { spawn } from 'node:child_process';

const STATS_URL = 'https://oh.feega.app/app/admin/stats';

const OPENERS = {
  darwin: ['open', [STATS_URL]],
  win32: ['cmd', ['/c', 'start', '', STATS_URL]],
  linux: ['xdg-open', [STATS_URL]]
};

const [command, args] = OPENERS[process.platform] ?? OPENERS.linux;

spawn(command, args, { stdio: 'ignore', detached: true }).unref();
console.log(STATS_URL);
