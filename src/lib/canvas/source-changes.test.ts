import { describe, expect, it } from 'vitest';
import { SourceAction, pushLabel, changedRows, popoverOf, pushAskOf, ciOf, CiState, filesOfPatch, filesToPush, pushedNote, rowTitle, type FrameSync } from './source-changes';

const sync = (over: Partial<FrameSync> = {}): FrameSync => ({
  nodeId: 'n1',
  name: 'Home',
  state: 'modified',
  link: { entry: 'app/page.tsx', appRoot: '', baseSha: 'abcdef1234567', baseBranch: 'main', writable: true },
  push: null,
  ...over
});

const pull = (status: string, checks: { conclusion: string | null }[] = []) => ({ number: 4, url: 'https://github.com/acme/app/pull/4', status, checks: checks.map((c) => ({ name: 'ci', status: 'completed', ...c })) });

describe('il popover di un frame collegato', () => {
  it('dice file, commit corto e le azioni che lo stato permette', () => {
    expect(popoverOf(sync({ state: 'in_sync' }))).toEqual({ file: 'app/page.tsx', commit: 'abcdef1', branch: 'main', actions: [SourceAction.Detach] });
    expect(popoverOf(sync({ state: 'newer_upstream' })).actions).toEqual([SourceAction.Update, SourceAction.Detach]);
    expect(popoverOf(sync({ state: 'in_pull', push: { pull: pull('open') } })).actions).toEqual([SourceAction.ViewPr, SourceAction.Detach]);
  });

  it('il file sta sotto la app root', () => {
    expect(popoverOf(sync({ link: { ...sync().link, appRoot: 'apps/web' } })).file).toBe('apps/web/app/page.tsx');
  });
});

describe('il pannello Changes', () => {
  it('elenca solo i frame modificati o in conflitto', () => {
    const rows = changedRows([sync({ nodeId: 'a' }), sync({ nodeId: 'b', state: 'in_sync' }), sync({ nodeId: 'c', state: 'conflict' })]);

    expect(rows.map((r) => r.nodeId)).toEqual(['a', 'c']);
  });

  it('crea la PR con i soli frame spuntati, e la aggiorna se il ramo esiste', () => {
    const rows = [sync({ nodeId: 'a' }), sync({ nodeId: 'b', link: { ...sync().link, pushBranch: 'feega/home' } })];

    expect(pushAskOf(rows, new Set(['a']), 'home')).toEqual({ name: 'home', nodeIds: ['a'] });
    expect(pushAskOf(rows, new Set(['a', 'b']), 'x')).toEqual({ name: 'home', nodeIds: ['a', 'b'] });
  });

  it('nessun frame spuntato: nessuna richiesta', () => {
    expect(pushAskOf([sync()], new Set(), 'home')).toBeNull();
  });

  it('lo stato della CI riassume i check', () => {
    expect(ciOf(pull('open', []))).toBe(CiState.None);
    expect(ciOf(pull('open', [{ conclusion: null }]))).toBe(CiState.Running);
    expect(ciOf(pull('open', [{ conclusion: 'success' }, { conclusion: 'failure' }]))).toBe(CiState.Failed);
    expect(ciOf(pull('open', [{ conclusion: 'success' }, { conclusion: 'skipped' }]))).toBe(CiState.Passed);
  });
});

describe('il pannello Changes non invita a push sbagliati', () => {
  const PATCH = '--- a/src/app.css\n+++ b/src/app.css\n@@ -1,1 +1,1 @@\n-a\n+b\n--- a/src/routes/+page.svelte\n+++ b/src/routes/+page.svelte\n@@ -2,1 +2,1 @@\n-x\n+y\n';

  it('ogni riga dice la pagina e i file cambiati, ognuno col suo diff', () => {
    expect(filesOfPatch(PATCH)).toEqual([
      { path: 'src/app.css', diff: '@@ -1,1 +1,1 @@\n-a\n+b\n' },
      { path: 'src/routes/+page.svelte', diff: '@@ -2,1 +2,1 @@\n-x\n+y\n' }
    ]);
    expect(rowTitle(sync({ link: { ...sync().link, route: '/chi-siamo' } }))).toBe('/chi-siamo');
    expect(rowTitle(sync())).toBe('Home');
  });

  it('la conferma elenca esattamente i file dei frame spuntati, una volta sola', () => {
    const files = new Map([
      ['a', filesOfPatch(PATCH)],
      ['b', [{ path: 'src/app.css', diff: '' }]],
      ['c', [{ path: 'src/lib/Other.svelte', diff: '' }]]
    ]);
    expect(filesToPush(new Set(['a', 'b']), files)).toEqual(['src/app.css', 'src/routes/+page.svelte']);
  });
});

describe('dopo il push', () => {
  it('senza PR lo dice, e dice come averla', () => {
    expect(pushedNote({ branch: 'feega/x', pull: null })).toBe('Branch feega/x pushed. No PR opened: connect GitHub or set a token');
  });

  it('con la PR la nomina', () => {
    expect(pushedNote({ branch: 'feega/x', pull: pull('open') })).toBe('Branch feega/x pushed · PR #4');
  });
});

describe('il bottone del push', () => {
  it('dice cosa farà davvero', () => {
    const pushed = (pullNumber?: number) => sync({ link: { ...sync().link, pushBranch: 'feega/x', pullNumber } });
    expect(pushLabel([sync()])).toBe('Push and open PR');
    expect(pushLabel([pushed()])).toBe('Update branch');
    expect(pushLabel([pushed(4)])).toBe('Update PR');
  });
});
