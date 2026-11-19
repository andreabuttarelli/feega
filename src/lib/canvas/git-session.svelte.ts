import { AutosaveState, codeAutosave, outcomeOf } from './code-autosave';
import { commitDue, commitSummary, gitSummary, withGit } from './git-status';
import type { FrameSync } from './source-changes';

const COMMIT_CHECK_MS = 15_000;
const COMMIT_NAME = 'canvas-edits';

type Answer = { ok?: boolean; refusal?: string } & Record<string, unknown>;

export type GitSources = { all: () => FrameSync[]; refresh: () => Promise<unknown> };

export type PullKindAsk = 'draft' | 'ready';

export function gitSession(projectId: () => string, sources: GitSources, nameOf: (nodeId: string) => string, fetchFn: typeof fetch = fetch) {
  let autosaveState = $state(AutosaveState.Idle);
  let autosaveOn = $state(true);
  let savedAt = $state<number | null>(null);
  let firstAt = $state<number | null>(null);
  let lastAt = $state<number | null>(null);
  let note = $state('');

  const url = (path = '') => `/api/v1/projects/${projectId()}/github/push${path}`;
  const post = async (path: string, body: unknown, keepalive = false): Promise<Answer | null> => {
    const res = await fetchFn(url(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive }).catch(() => null);
    return (await res?.json().catch(() => null)) as Answer | null;
  };
  const githubIds = () => withGit(sources.all()).map((s) => s.nodeId);

  const autosave = codeAutosave({
    save: async (nodeIds) => {
      const rows = withGit(sources.all()).filter((s) => nodeIds.includes(s.nodeId));
      if (!rows.length) {
        return AutosaveState.Saved;
      }
      const live = rows.every((r) => r.caps && !r.caps.wip);
      const state = live ? (rows[0].link.workBranch ? AutosaveState.Saved : AutosaveState.NeedsBranch) : outcomeOf(await post('/wip', { nodeIds: rows.map((r) => r.nodeId) }));
      if (state === AutosaveState.Saved) {
        const now = Date.now();
        firstAt ??= now;
        lastAt = now;
      }
      return state;
    },
    onstate: (state) => {
      autosaveState = state;
      if (state === AutosaveState.Saved) {
        savedAt = Date.now();
      }
    }
  });

  const draftMessage = () => {
    const rows = withGit(sources.all()).filter((s) => s.state === 'modified' || s.state === 'conflict');
    return commitSummary(rows.map((r) => nameOf(r.nodeId) || r.name || 'frame'), [...new Set(rows.map((r) => r.link.entry))]);
  };

  async function commit(message?: string, keepalive = false) {
    const nodeIds = githubIds();
    if (!nodeIds.length) {
      return null;
    }
    const [title, ...rest] = (message ?? draftMessage()).split('\n');
    const body = await post('', { name: COMMIT_NAME, nodeIds, title, body: rest.join('\n').trim() || title }, keepalive);
    if (body?.ok) {
      firstAt = null;
      lastAt = null;
    }
    note = body?.ok ? '' : body?.refusal === 'protected' ? 'GitHub refused the commit: the branch is protected.' : body?.refusal ? `Commit refused: ${body.refusal}` : '';
    if (!keepalive) {
      await sources.refresh();
    }
    return body;
  }

  $effect(() => {
    const timer = setInterval(() => {
      if (autosaveOn && commitDue({ firstAt, lastAt, now: Date.now() })) {
        void commit();
      }
    }, COMMIT_CHECK_MS);
    const flush = () => {
      if (firstAt !== null) {
        void commit(undefined, true);
      }
    };
    addEventListener('pagehide', flush);
    return () => {
      clearInterval(timer);
      removeEventListener('pagehide', flush);
      autosave.stop();
    };
  });

  return {
    get autosaveState() {
      return autosaveState;
    },
    get autosaveOn() {
      return autosaveOn;
    },
    set autosaveOn(on: boolean) {
      autosaveOn = on;
    },
    get savedAt() {
      return savedAt;
    },
    get uncommitted() {
      return firstAt !== null;
    },
    get note() {
      return note;
    },
    summary: () => gitSummary(sources.all(), autosaveState),
    draftMessage,
    touch: (nodeId: string) => {
      if (autosaveOn) {
        autosave.touch(nodeId);
      }
    },
    resume: () => autosave.resume(),
    commit,
    choose: async (branch: string, from?: string) => {
      const body = await post('/branch', { nodeIds: githubIds(), branch, ...(from ? { from } : {}) });
      note = body?.ok ? '' : `Branch refused: ${String(body?.refusal ?? 'network')}`;
      await sources.refresh();
      if (body?.ok) {
        autosave.resume();
      }
      return body;
    },
    openPull: async (nodeId: string, base: string, kind: PullKindAsk = 'draft') => {
      const body = await post('/pull', { nodeId, base, kind });
      note = body?.ok ? '' : `Pull request refused: ${String(body?.refusal ?? 'network')}`;
      await sources.refresh();
      return body;
    },
    ready: async (nodeId: string) => {
      await post('/ready', { nodeId });
      await sources.refresh();
    },
    undo: async (nodeId: string) => {
      const body = await post('/undo', { nodeId });
      note = body?.ok ? 'Last commit undone' : `Undo refused: ${String(body?.refusal ?? 'network')}`;
      await sources.refresh();
    }
  };
}

export type GitSession = ReturnType<typeof gitSession>;
