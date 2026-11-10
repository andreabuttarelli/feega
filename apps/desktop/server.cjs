const { spawn, execFileSync } = require('node:child_process');
const { createServer } = require('node:net');
const { dirname, join } = require('node:path');
const { pathToFileURL } = require('node:url');

const LOOPBACK = '127.0.0.1';
const READY_MS = 120_000;
const POLL_MS = 200;
const FLUSH_GRACE_MS = 1_500;

const ended = (child) => child.exitCode !== null || child.signalCode !== null;
const SHELL_TIMEOUT_MS = 5_000;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, LOOPBACK, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function loginPath(env) {
  try {
    return execFileSync(env.SHELL || '/bin/zsh', ['-ilc', 'printf %s "$PATH"'], { encoding: 'utf8', timeout: SHELL_TIMEOUT_MS }).trim() || env.PATH;
  } catch {
    return env.PATH;
  }
}

async function ready(url, child) {
  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    if (ended(child)) {
      throw new Error(`the local server exited with code ${child.exitCode}`);
    }
    const answered = await fetch(url, { redirect: 'manual' }).then(() => true, () => false);
    if (answered) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error('the local server did not start in time');
}

function stopper(child) {
  return () =>
    new Promise((resolve) => {
      if (ended(child)) {
        resolve();
        return;
      }
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), FLUSH_GRACE_MS).unref();
    });
}

async function startServer({ root, file, port, env }) {
  const { localEnv, fileEnv } = await import(pathToFileURL(join(root, 'scripts/local.mjs')).href);
  const child = spawn(process.execPath, [join(root, 'scripts/node-server.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...localEnv(file, String(port), { ...env, PATH: loginPath(env) }, fileEnv(dirname(file), root)), ELECTRON_RUN_AS_NODE: '1' }
  });
  const url = `http://${LOOPBACK}:${port}/`;
  const stop = stopper(child);
  await ready(url, child).catch(async (error) => {
    await stop();
    throw error;
  });
  return { url, stop };
}

module.exports = { startServer, freePort, stopper, LOOPBACK };
