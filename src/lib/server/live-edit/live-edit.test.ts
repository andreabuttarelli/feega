import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIVE_BRANCH, LIVE_DIR_ENV, liveCheckoutOf } from './live-checkout';
import { Publish, localGitHost } from '$lib/server/code-push/local-git-host';
import { memoryLock } from '$lib/server/code-push/push-lock';
import { liveChanges, liveEdit, livePush, liveUndo } from './live-edit';
import { LiveProp } from '$lib/canvas/live-fields';

const HERO = `export function Hero() {
  return <h1 className="text-5xl font-semibold text-black">Ship faster</h1>;
}
`;

process.env[LIVE_DIR_ENV] = realpathSync(mkdtempSync(join(tmpdir(), 'live-home-')));

const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'live-edit-')));
  run(dir, 'init', '-q', '-b', 'main');
  run(dir, 'config', 'user.email', 'test@example.com');
  run(dir, 'config', 'user.name', 'Test');
  mkdirSync(join(dir, 'app'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'app/Hero.tsx'), HERO);
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  run(dir, 'add', '.');
  run(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

const H1 = 'app/Hero.tsx:2:10';

describe('live edit on the feega worktree', () => {
  it('la modifica atterra sul ramo feega/live, mai sulla copia di lavoro', async () => {
    const dir = repo();
    writeFileSync(join(dir, 'notes.txt'), 'uncommitted work');
    const live = liveCheckoutOf(dir);

    const out = await liveEdit(live, { at: H1, prop: LiveProp.Color, token: 'red-600' });

    expect(out.ok).toBe(true);
    expect(readFileSync(join(live, 'app/Hero.tsx'), 'utf8')).toContain('text-5xl font-semibold text-red-600');
    expect(readFileSync(join(dir, 'app/Hero.tsx'), 'utf8')).toBe(HERO);
    expect(run(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(readFileSync(join(dir, 'notes.txt'), 'utf8')).toBe('uncommitted work');
    expect(run(dir, 'log', '-1', '--format=%s', LIVE_BRANCH)).toMatch(/app\/Hero\.tsx:2/);
    expect(existsSync(join(live, 'node_modules'))).toBe(true);
  });

  it('il valore calcolato passa dai token del repo', async () => {
    const live = liveCheckoutOf(repo());

    const out = await liveEdit(live, { at: H1, prop: LiveProp.Color, value: 'rgb(255, 59, 48)' });

    expect(out.ok && out.token).toBe('[#ff3b30]');
  });

  it('annullare riporta il file com era, con un commit in avanti', async () => {
    const live = liveCheckoutOf(repo());
    const out = await liveEdit(live, { at: H1, prop: LiveProp.Text, value: 'Ship today', was: 'Ship faster' });
    if (!out.ok) {
      throw new Error('edit refused');
    }

    await liveUndo(live, out.sha);

    expect(readFileSync(join(live, 'app/Hero.tsx'), 'utf8')).toBe(HERO);
  });

  it('le modifiche del ramo sono la patch del pannello Changes', async () => {
    const live = liveCheckoutOf(repo());
    await liveEdit(live, { at: H1, prop: LiveProp.Text, value: 'Ship today', was: 'Ship faster' });

    const changes = await liveChanges(live);

    expect(changes.files).toEqual(['app/Hero.tsx']);
    expect(changes.patch).toContain('+  return <h1 className="text-5xl font-semibold text-black">Ship today</h1>;');
  });

  it('il push porta le modifiche su un ramo feega/ come ogni altra modifica', async () => {
    const dir = repo();
    const live = liveCheckoutOf(dir);
    await liveEdit(live, { at: H1, prop: LiveProp.Text, value: 'Ship today', was: 'Ship faster' });

    const pushed = await livePush(live, localGitHost(dir, { publish: Publish.Local }), memoryLock());

    expect(pushed.ok && pushed.branch).toBe('feega/live-edits');
    expect(run(dir, 'show', 'feega/live-edits:app/Hero.tsx')).toContain('Ship today');
  });

  it('un elemento non trovato è un rifiuto, nessun commit', async () => {
    const live = liveCheckoutOf(repo());
    const before = run(live, 'rev-parse', 'HEAD');

    const out = await liveEdit(live, { at: 'app/Hero.tsx:1:1', prop: LiveProp.Color, token: 'red-600' });

    expect(out.ok).toBe(false);
    expect(run(live, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('due modifiche partite insieme atterrano entrambe, una dopo l altra', async () => {
    const live = liveCheckoutOf(repo());

    const both = await Promise.all([
      liveEdit(live, { at: H1, prop: LiveProp.Color, token: 'red-600' }),
      liveEdit(live, { at: H1, prop: LiveProp.FontWeight, token: 'bold' })
    ]);

    expect(both.map((out) => out.ok)).toEqual([true, true]);
    expect(readFileSync(join(live, 'app/Hero.tsx'), 'utf8')).toContain('text-5xl font-bold text-red-600');
  });
});
