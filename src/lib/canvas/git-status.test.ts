import { describe, expect, it } from 'vitest';
import { AutosaveState } from './code-autosave';
import { autosaveAsk, BranchMode, gitSummary } from './git-status';
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

describe('autosave: cosa spinge', () => {
  it('solo i frame GitHub, come PR in bozza', () => {
    const rows = [sync(), sync({ nodeId: 'n2', link: { ...sync().link, source: 'folder' } })];

    expect(autosaveAsk(rows, ['n1', 'n2'], { mode: BranchMode.Session, branch: '', commitTo: '' })).toEqual({ name: 'canvas-edits', nodeIds: ['n1'], pull: 'draft' });
  });

  it('un ramo scelto e il commit diretto passano al server', () => {
    expect(autosaveAsk([sync()], ['n1'], { mode: BranchMode.Session, branch: 'design/hero', commitTo: '' })).toMatchObject({ branch: 'design/hero' });
    expect(autosaveAsk([sync()], ['n1'], { mode: BranchMode.Direct, branch: 'ignored', commitTo: 'release' })).toMatchObject({ target: 'branch', branch: 'release' });
  });

  it('nulla da spingere è null', () => {
    expect(autosaveAsk([sync({ link: { ...sync().link, source: 'folder' } })], ['n1'], { mode: BranchMode.Session, branch: '', commitTo: '' })).toBeNull();
  });
});

describe('lo stato git nella barra in alto', () => {
  it('nessun frame GitHub, nessuno stato', () => {
    expect(gitSummary([], AutosaveState.Idle)).toBeNull();
  });

  it('repo, ramo di lavoro, cambi a monte, PR in bozza e CI', () => {
    const s = sync({ link: { ...sync().link, pushBranch: 'feega/canvas-edits' }, push: { pull, upstream: [{ path: 'a' }, { path: 'b' }] } });

    expect(gitSummary([s], AutosaveState.Saved)).toEqual({ repo: 'acme/app', branch: 'feega/canvas-edits', base: 'main', upstream: 2, pull, draft: true, ci: CiState.Passed, autosave: AutosaveState.Saved, nodeId: 'n1' });
  });

  it('prima della prima modifica il ramo è la base', () => {
    expect(gitSummary([sync()], AutosaveState.Idle)).toMatchObject({ branch: 'main', pull: null, draft: false, ci: CiState.None });
  });
});
