import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECKOUT_HINT = 'feega local runs the app from a feega checkout:\n  git clone https://github.com/andreabuttarelli/feega && cd feega && npm install\n  npm run local -- canvas.feega   (or, from the checkout: feega local canvas.feega)';

function inCheckout(dir: string): boolean {
  const manifest = join(dir, 'package.json');
  return existsSync(manifest) && (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name === 'feega';
}

export async function cmdLocal(file: string, options: { port?: string; build?: boolean }) {
  const root = process.cwd();
  if (!inCheckout(root)) {
    throw new Error(CHECKOUT_HINT);
  }
  const args = ['scripts/local.mjs', resolve(file), ...(options.port ? [`--port=${options.port}`] : []), ...(options.build ? ['--build'] : [])];
  const child = spawn('node', args, { cwd: root, stdio: 'inherit' });
  await new Promise<void>((done) => child.on('exit', (code) => {
    process.exitCode = code ?? 0;
    done();
  }));
}
