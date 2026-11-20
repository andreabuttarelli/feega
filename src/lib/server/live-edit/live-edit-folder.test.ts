import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { liveChanges, liveEdit, liveUndo } from './live-edit';
import { LIVE_TARGET_ENV, LiveTarget, liveRootOf } from './live-target';

process.env[LIVE_TARGET_ENV] = LiveTarget.Folder;

const HERO = `export function Hero() {
  return <h1 className="text-5xl font-semibold text-black">Ship faster</h1>;
}
`;

const H1 = 'app/Hero.tsx:2:10';

const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'live-folder-')));
  run(dir, 'init', '-q', '-b', 'main');
  run(dir, 'config', 'user.email', 'test@example.com');
  run(dir, 'config', 'user.name', 'Test');
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'app/Hero.tsx'), HERO);
  run(dir, 'add', '.');
  run(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

const hero = (dir: string) => readFileSync(join(dir, 'app/Hero.tsx'), 'utf8');

describe('live edit nella cartella di lavoro', () => {
  it('la modifica atterra nel file che il vibe coder e il suo agente stanno usando, senza commit né rami', async () => {
    const dir = repo();

    const out = await liveEdit(liveRootOf(dir), { at: H1, prop: LiveProp.Color, token: 'red-600' });

    expect(out.ok).toBe(true);
    expect(hero(dir)).toContain('text-5xl font-semibold text-red-600');
    expect(run(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(run(dir, 'log', '--oneline')).toHaveLength(run(dir, 'log', '-1', '--oneline').length);
    expect(run(dir, 'branch', '--list', 'feega/*')).toBe('');
  });

  it('il lavoro non committato resta e la modifica si somma', async () => {
    const dir = repo();
    writeFileSync(join(dir, 'app/Hero.tsx'), HERO.replace('Ship faster', 'Ship today'));

    await liveEdit(dir, { at: H1, prop: LiveProp.Color, token: 'red-600' });

    expect(hero(dir)).toContain('text-red-600">Ship today');
  });

  it('annullare rimette il file com era', async () => {
    const dir = repo();
    const done = await liveEdit(dir, { at: H1, prop: LiveProp.Color, token: 'red-600' });

    const undone = done.ok ? await liveUndo(dir, done.sha) : done;

    expect(undone.ok).toBe(true);
    expect(hero(dir)).toBe(HERO);
  });

  it('annullare non cancella ciò che un agente ha scritto dopo nello stesso file', async () => {
    const dir = repo();
    const done = await liveEdit(dir, { at: H1, prop: LiveProp.Color, token: 'red-600' });
    writeFileSync(join(dir, 'app/Hero.tsx'), hero(dir).replace('Ship faster', 'Ship now'));

    const undone = done.ok ? await liveUndo(dir, done.sha) : done;

    expect(undone.ok).toBe(false);
    expect(hero(dir)).toContain('Ship now');
  });

  it('Changes elenca solo i file toccati dal canvas, non il resto del lavoro in corso', async () => {
    const dir = repo();
    writeFileSync(join(dir, 'notes.md'), 'mine');
    await liveEdit(dir, { at: H1, prop: LiveProp.Color, token: 'red-600' });

    const changes = await liveChanges(dir);

    expect(changes.files).toEqual(['app/Hero.tsx']);
    expect(changes.patch).toContain('+  return <h1 className="text-5xl font-semibold text-red-600">');
  });
});
