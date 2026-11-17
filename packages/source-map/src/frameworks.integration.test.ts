import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ENABLED = process.env.SOURCE_MAP_E2E === '1';
const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
const BOOT_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 300_000;

type Fixture = {
  dir: string;
  dev: (port: number) => string[];
  build: string[];
  output: string;
  click: string;
  expected: { file: string; line: number };
  component: string;
};

const FIXTURES_BY_NAME: Record<string, Fixture> = {
  'vite-react': {
    dir: 'vite-react',
    dev: (port) => ['vite', '--port', String(port), '--strictPort'],
    build: ['vite', 'build'],
    output: 'dist',
    click: '#buy',
    expected: { file: 'src/Pricing.tsx', line: 5 },
    component: 'src/main.tsx'
  },
  next15: {
    dir: 'next15',
    dev: (port) => ['next', 'dev', '--port', String(port)],
    build: ['next', 'build'],
    output: '.next',
    click: '#cta',
    expected: { file: 'app/Hero.tsx', line: 7 },
    component: 'app/page.tsx'
  }
};

describe.skipIf(!ENABLED).each(Object.entries(FIXTURES_BY_NAME))('%s', (_name, fixture) => {
  const cwd = join(FIXTURES, fixture.dir);
  let browser: Browser;
  let server: ChildProcess;
  let url: string;

  beforeAll(async () => {
    if (!existsSync(join(cwd, 'node_modules'))) {
      spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd, stdio: 'inherit' });
    }

    const port = await freePort();
    url = `http://localhost:${port}/`;
    server = spawn(bin(cwd, fixture.dev(port)[0]), fixture.dev(port).slice(1), { cwd, stdio: 'ignore' });
    await waitFor(url);
    browser = await chromium.launch();
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
    server?.kill();
  });

  it('maps a clicked element to its file:line through the bridge', async () => {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector(`${fixture.click}[data-feega-src]`, { timeout: BOOT_TIMEOUT_MS });

    const reply = page.evaluate(
      () =>
        new Promise<{ result: { source: { file: string; line: number }; component: { file: string }; html: string } }>((resolve) => {
          addEventListener('message', (event) => event.data?.type === 'feega:inspect:result' && resolve(event.data));
          addEventListener('click', (event) => postMessage({ type: 'feega:inspect', id: 1, x: event.clientX, y: event.clientY }, '*'), { once: true });
        })
    );
    await page.click(fixture.click);
    const { result } = await reply;

    expect(result.source).toMatchObject(fixture.expected);
    expect(result.component.file).toBe(fixture.component);
    expect(result.html).toContain('data-feega-src');
  }, TEST_TIMEOUT_MS);

  it('leaves no data-feega-src in the production build', () => {
    const build = spawnSync(bin(cwd, fixture.build[0]), fixture.build.slice(1), { cwd, encoding: 'utf8' });
    expect(build.status, build.stderr).toBe(0);

    const tagged = filesUnder(join(cwd, fixture.output)).filter((file) => readFileSync(file, 'utf8').includes('data-feega-src'));
    expect(tagged).toEqual([]);
  }, TEST_TIMEOUT_MS);
});

function bin(cwd: string, name: string): string {
  return join(cwd, 'node_modules', '.bin', name);
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'cache') {
      return [];
    }
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await fetch(url).then((r) => r.ok, () => false);
    if (ok) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server never answered at ${url}`);
}
