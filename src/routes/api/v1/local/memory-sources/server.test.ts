import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: true, home: '' }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (state.on ? {} : null) }));
vi.mock('node:os', async (real) => ({ ...(await real<typeof import('node:os')>()), homedir: () => state.home }));

const { GET, POST } = await import('./+server');

const post = (body: unknown) => POST({ request: new Request('http://l/x', { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('/api/v1/local/memory-sources', () => {
  beforeEach(async () => {
    state.on = true;
    state.home = await mkdtemp(join(tmpdir(), 'ms-'));
    await mkdir(join(state.home, '.codex'));
    await writeFile(join(state.home, '.codex', 'AGENTS.md'), 'codex rules');
  });

  it('lists found sources and reads the chosen ones', async () => {
    const { sources } = await (await GET({} as never)).json();
    expect(sources).toContainEqual({ id: 'codex', label: 'Codex', path: join(state.home, '.codex', 'AGENTS.md'), bytes: 11 });

    expect(await (await post({ ids: ['codex'] })).json()).toEqual({ content: '## Codex\n\ncodex rules' });
  });

  it('rejects ids that are not a string array', async () => {
    await expect(post({ ids: 'codex' })).rejects.toMatchObject({ status: 400 });
  });

  it('is 404 outside local mode', async () => {
    state.on = false;

    await expect(GET({} as never)).rejects.toMatchObject({ status: 404 });
  });
});
