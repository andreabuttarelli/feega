import { describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '$lib/server/code-push/git-cli';

const held: { store: { flush: () => Promise<void> } | null } = { store: null };

vi.mock('$lib/server/local/local-mode', () => ({ LOCAL_FILE_ENV: 'FEEGA_LOCAL_FILE', localStore: () => held.store }));

const { GET, POST } = await import('./+server');

const NOT_FOUND = 404;

async function openedRepo() {
  const dir = await mkdtemp(join(tmpdir(), 'feega-git-route-'));
  await git(dir, ['init', '-q', '-b', 'work']);
  await git(dir, ['config', 'user.email', 't@t']);
  await git(dir, ['config', 'user.name', 't']);
  await mkdir(join(dir, '.feega'));
  await writeFile(join(dir, '.feega', 'canvas.json'), '{}');
  process.env.FEEGA_LOCAL_FILE = dir;
  held.store = { flush: vi.fn(async () => undefined) };
  return dir;
}

const post = (body: unknown) => POST({ request: new Request('http://x/local/git', { method: 'POST', body: JSON.stringify(body) }) });

describe('/local/git: il git della cartella aperta', () => {
  it('fuori dalla modalità locale non esiste', async () => {
    held.store = null;
    await expect(GET()).rejects.toMatchObject({ status: NOT_FOUND });
  });

  it('dice il ramo della cartella aperta', async () => {
    await openedRepo();
    expect(await (await GET()).json()).toMatchObject({ git: true, branch: 'work', changes: 1 });
  });

  it('il commit salva prima la tela su disco, poi committa .feega/', async () => {
    const dir = await openedRepo();
    const status = await (await post({ action: 'commit', message: 'Update canvas' })).json();
    expect(held.store!.flush).toHaveBeenCalled();
    expect(status).toMatchObject({ changes: 0 });
    expect((await git(dir, ['log', '-1', '--format=%s'])).out.trim()).toBe('Update canvas');
  });

  it('la PR locale apre sempre la pagina compare: nessun token, nessuna chiamata API', async () => {
    const dir = await openedRepo();
    const remote = await mkdtemp(join(tmpdir(), 'feega-git-remote-'));
    await git(remote, ['init', '-q', '--bare']);
    await git(dir, ['commit', '-q', '--allow-empty', '-m', 'x']);
    await git(dir, ['remote', 'add', 'origin', 'git@github.com:acme/site.git']);
    await git(dir, ['config', 'remote.origin.pushurl', remote]);
    process.env.GITHUB_PUSH_TOKEN = 'tok';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const body = await (await post({ action: 'pull' })).json();

    expect(body.message).toBeUndefined();
    expect(body.url).toBe('https://github.com/acme/site/compare/main...work?expand=1');
    expect(fetchSpy).not.toHaveBeenCalled();
    delete process.env.GITHUB_PUSH_TOKEN;
  });

  it('un push senza origin torna come errore leggibile, non come 500', async () => {
    await openedRepo();
    const res = await post({ action: 'push' });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/origin/);
  });
});
