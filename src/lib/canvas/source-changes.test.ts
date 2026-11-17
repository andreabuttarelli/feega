import { describe, expect, it } from 'vitest';
import { SourceAction, changedRows, popoverOf, pushAskOf, ciOf, CiState, impactOf, type FrameSync } from './source-changes';

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
    expect(popoverOf(sync({ state: 'in_sync' }))).toEqual({ file: 'app/page.tsx', commit: 'abcdef1', branch: 'main', actions: [SourceAction.MakeVariant, SourceAction.Detach] });
    expect(popoverOf(sync({ state: 'newer_upstream' })).actions).toEqual([SourceAction.Update, SourceAction.MakeVariant, SourceAction.Detach]);
    expect(popoverOf(sync({ state: 'in_pull', push: { pull: pull('open') } })).actions).toEqual([SourceAction.ViewPr, SourceAction.MakeVariant, SourceAction.Detach]);
    expect(popoverOf(sync({ link: { ...sync().link, variantOf: 'n0' } })).actions).not.toContain(SourceAction.MakeVariant);
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

  it('una modifica a un file condiviso dice quante pagine tocca', () => {
    expect(impactOf(sync({ affected: [{ path: 'components/Button.tsx', pages: 3 }] }))).toBe('3 pages affected');
    expect(impactOf(sync())).toBeNull();
  });

  it('"applica al componente main" manda il frame tra i main', () => {
    expect(pushAskOf([sync({ nodeId: 'a' })], new Set(['a']), 'home', new Set(['a']))).toEqual({ name: 'home', nodeIds: ['a'], mains: ['a'] });
  });

  it('le varianti spuntate portano la scelta fatta', () => {
    const rows = [sync({ nodeId: 'v', link: { ...sync().link, variantOf: 'a' } })];

    expect(pushAskOf(rows, new Set(['v']), 'home', undefined, [{ nodeId: 'v', choice: 'new_route', route: '/home-b' }])).toEqual({ name: 'home', nodeIds: ['v'], variants: [{ nodeId: 'v', choice: 'new_route', route: '/home-b' }] });
  });
});
