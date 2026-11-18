import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.FEEGA_LIVE_TARGET = 'branch';
import { describe, expect, it, vi } from 'vitest';

const HERO = `export function Hero() {
  return <h1 className="text-5xl text-black">Ship faster</h1>;
}
`;

const app = vi.hoisted(() => ({ dir: '', on: true }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (app.on ? { path: join(app.dir, 'canvas.feega') } : null) }));

const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'live-edit-route-')));
  run(dir, 'init', '-q', '-b', 'main');
  run(dir, 'config', 'user.email', 'test@example.com');
  run(dir, 'config', 'user.name', 'Test');
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'app/Hero.tsx'), HERO);
  run(dir, 'add', '.');
  run(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

app.dir = repo();
process.env.FEEGA_LIVE_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'live-home-')));

const { GET, POST } = await import('./+server');

const post = (body: unknown) => POST({ request: new Request('http://x/api/v1/local/live-edit', { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('/api/v1/local/live-edit', () => {
  it('scrive la modifica sul ramo feega/live e la elenca in Changes', async () => {
    const res = await post({ at: 'app/Hero.tsx:2:10', prop: 'color', value: '#ff3b30' });
    const body = await res.json();

    expect(body).toMatchObject({ ok: true, token: '[#ff3b30]', files: ['app/Hero.tsx'] });
    expect(readFileSync(join(app.dir, 'app/Hero.tsx'), 'utf8')).toBe(HERO);
    expect(await (await GET({} as never)).json()).toMatchObject({ branch: 'feega/live', files: ['app/Hero.tsx'] });
  });

  it('undo annulla la modifica indicata', async () => {
    const done = await (await post({ at: 'app/Hero.tsx:2:10', prop: 'text', value: 'Ship today', was: 'Ship faster' })).json();

    const undone = await (await post({ undo: done.sha })).json();

    expect(undone.ok).toBe(true);
  });

  it('un elemento non trovato è un 409 con la ragione', async () => {
    await expect(post({ at: 'app/Hero.tsx:1:1', prop: 'color', value: 'red' })).rejects.toMatchObject({ status: 409 });
  });

  it('una proprietà sconosciuta è un 400', async () => {
    await expect(post({ at: 'app/Hero.tsx:2:10', prop: 'shadow', value: 'x' })).rejects.toMatchObject({ status: 400 });
  });

  it('fuori dalla modalità locale non esiste', async () => {
    app.on = false;
    await expect(GET({} as never)).rejects.toMatchObject({ status: 404 });
    app.on = true;
  });
});
