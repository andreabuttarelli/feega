import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import type { FeegaStore } from '$lib/server/local/feega-store';
import { LOCAL_ORG_ID } from '$lib/local-user';
import { liveCheckoutOf } from '$lib/server/live-edit/live-checkout';
import { devServer, type DevServer } from './dev-server';
import { answers, candidateUrls, findRunning, servesFolder } from './probe';
import { superviseDev } from './supervisor';
import type { PosterDeps } from './live-poster';

const DEV_DIR_ENV = 'FEEGA_DEV_DIR';
const DEV_COMMAND_ENV = 'FEEGA_DEV_COMMAND';
const DEV_URL_ENV = 'FEEGA_DEV_URL';
const MAX_RESTARTS = 3;
const LOCKFILES = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', 'package-lock.json'];
const ASSET_BUCKET = 'canvas-assets';
const POSTER_HEIGHT = 900;
const SETTLE_MS = 400;

const run = promisify(execFile);

async function cwdOfPort(port: number): Promise<string | null> {
  try {
    const listening = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
    const pid = listening.stdout.trim().split('\n')[0];
    const cwd = await run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
    const line = cwd.stdout.split('\n').find((l) => l.startsWith('n'));
    return line ? realpathSync(line.slice(1)) : null;
  } catch {
    return null;
  }
}

let current: { folder: string; server: DevServer; stop: () => void } | null = null;

function repoOf(folder: string) {
  const manifest = join(folder, 'package.json');
  return {
    packageJson: existsSync(manifest) ? readFileSync(manifest, 'utf8') : '{}',
    lockfiles: LOCKFILES.filter((f) => existsSync(join(folder, f))),
    configured: process.env[DEV_COMMAND_ENV]
  };
}

export const devFolder = (store: FeegaStore) => liveCheckoutOf(realpathSync(process.env[DEV_DIR_ENV] ?? dirname(store.path)));

export function localDevServer(store: FeegaStore): DevServer {
  const folder = devFolder(store);
  if (current?.folder === folder) {
    return current.server;
  }

  current?.stop();
  const supervisor = superviseDev({ spawn: (command, cwd) => spawn(command.bin, command.args, { cwd, env: { ...process.env, PORT: '' }, stdio: 'pipe' }), maxRestarts: MAX_RESTARTS });
  const self = Number(process.env.PORT) || undefined;
  const configured = process.env[DEV_URL_ENV];
  const ours = async (url: string) => (await answers(url)) && (url === configured || (await servesFolder(url, folder, cwdOfPort)));
  const running = () => findRunning(candidateUrls({ configured, self }), ours);
  const server = devServer({ folder, repo: () => repoOf(folder), running, supervisor });
  process.once('exit', supervisor.stop);
  current = { folder, server, stop: supervisor.stop };
  return server;
}

async function screenshot(url: string, width: number): Promise<Uint8Array> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: POSTER_HEIGHT } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_MS);
    return new Uint8Array(await page.screenshot({ type: 'png' }));
  } finally {
    await browser.close();
  }
}

export function posterDeps(store: FeegaStore, origin: string): PosterDeps {
  const db = store.db;
  return {
    origin,
    capture: screenshot,
    async readNode(id) {
      const { data } = await db.from('nodes').select('id, data').eq('id', id).maybeSingle();
      return data ? { id: String(data.id), data: (data.data ?? {}) as Record<string, unknown> } : null;
    },
    async saveImage(bytes) {
      const id = crypto.randomUUID();
      const path = `${canvasUploadPrefix(LOCAL_ORG_ID, store.place.projectId)}${id}.png`;
      await db.storage.from(ASSET_BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: true });
      await db.from('assets').insert({ id, org_id: LOCAL_ORG_ID, project_id: store.place.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/png', bytes: bytes.byteLength });
      return id;
    },
    async writeData(id, data) {
      const { data: row } = await db.from('nodes').select('version').eq('id', id).maybeSingle();
      await db.from('nodes').update({ data, version: Number(row?.version ?? 0) + 1 }).eq('id', id);
    }
  };
}
