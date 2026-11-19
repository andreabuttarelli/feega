import { describe, expect, it } from 'vitest';
import { AutosaveState } from './code-autosave';
import { commitDue, commitSummary, gitSummary, onGithub, COMMIT_IDLE_MS, COMMIT_MAX_MS } from './git-status';
import { CiState, type FrameSync } from './source-changes';

const sync = (over: Partial<FrameSync> = {}): FrameSync => ({
  nodeId: 'n1',
  name: 'Home',
  state: 'modified',
  link: { entry: 'app/page.tsx', appRoot: '', baseSha: 'abcdef1234567', baseBranch: 'main', writable: true, repo: 'acme/app', source: 'github' },
  push: null,
  ...over
});

const pull = { number: 4, url: 'https://github.com/acme/app/pull/4', status: 'open', draft: true, checks: [{ name: 'ci', status: 'completed', conclusion: 'success' }] };

describe('frame GitHub', () => {
  it('solo i frame GitHub, non le cartelle locali', () => {
    expect(onGithub([sync(), sync({ nodeId: 'n2', link: { ...sync().link, source: 'folder' } })]).map((s) => s.nodeId)).toEqual(['n1']);
  });
});

describe('il messaggio di commit', () => {
  it('dice quali frame e quanti file, sempre uguale per lo stesso cambiamento', () => {
    expect(commitSummary(['Home'], ['app/page.tsx'])).toBe('Update Home\n\n- app/page.tsx');
    expect(commitSummary(['Home', 'Pricing'], ['app/page.tsx', 'app/pricing/page.tsx'])).toBe('Update Home and Pricing\n\n- app/page.tsx\n- app/pricing/page.tsx');
    expect(commitSummary(['Home', 'Pricing', 'About', 'Blog'], ['a'])).toBe('Update Home, Pricing and 2 more\n\n- a');
  });
});

describe('quando si committa', () => {
  it('dopo una pausa, o al più tardi dopo un tempo massimo; mai senza modifiche', () => {
    expect(commitDue({ firstAt: null, lastAt: null, now: 0 })).toBe(false);
    expect(commitDue({ firstAt: 0, lastAt: 0, now: COMMIT_IDLE_MS - 1 })).toBe(false);
    expect(commitDue({ firstAt: 0, lastAt: 0, now: COMMIT_IDLE_MS })).toBe(true);
    expect(commitDue({ firstAt: 0, lastAt: COMMIT_MAX_MS - 1, now: COMMIT_MAX_MS })).toBe(true);
  });
});

describe('lo stato git nella barra in alto', () => {
  it('nessun frame GitHub, nessuno stato', () => {
    expect(gitSummary([], AutosaveState.Idle)).toBeNull();
  });

  it('senza ramo di lavoro chiede di sceglierlo, proponendo il ramo importato', () => {
    expect(gitSummary([sync()], AutosaveState.Idle)).toMatchObject({ branch: null, imported: 'main', pull: null, ci: CiState.None });
  });

  it('ramo di lavoro, cambi a monte, PR in bozza e CI', () => {
    const s = sync({ link: { ...sync().link, workBranch: 'design/hero' }, push: { pull, upstream: [{ path: 'a' }, { path: 'b' }] } });

    expect(gitSummary([s], AutosaveState.Saved)).toEqual({ repo: 'acme/app', branch: 'design/hero', imported: 'main', upstream: 2, pull, draft: true, ci: CiState.Passed, autosave: AutosaveState.Saved, nodeId: 'n1' });
  });
});
