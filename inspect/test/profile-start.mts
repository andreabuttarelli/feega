import { resolve } from 'node:path';
import { Attach, startDev } from '../src/host/dev-server';

const [app, mode] = process.argv.slice(2);
const attach = mode === 'attach' ? Attach.IfRunning : Attach.Never;
const begun = Date.now();
const started = await startDev(resolve(app), resolve('dist/launcher'), { log: (l) => l.startsWith('feega timeline') && process.stdout.write(l), installing: () => undefined, spawned: () => undefined, signal: new AbortController().signal }, '', attach);
console.log('wall', Date.now() - begun, 'ms', 'refused' in started ? started.refused : started.url);
if (!('refused' in started)) {
  await fetch(started.url).then((r) => r.text());
  console.log('first page', Date.now() - begun, 'ms');
  started.stop();
}
setTimeout(() => process.exit(0), 3500);
