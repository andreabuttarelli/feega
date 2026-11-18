import { describe, expect, it, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const finishVideoRender = vi.fn();
const submittedFake = {
  taskId: 'kie-task-9',
  model: 'bytedance/seedance-2-5',
  prompt: 'un gatto',
  durationSeconds: 8,
  resolution: '720p',
  persistOpts: { captions: false, tighten: false },
  submittedAt: Date.now()
};
const withOrgContext = vi.fn();

vi.mock('$lib/server/video', () => ({
  submitVideoRender: async () => submittedFake,
  finishVideoRender: (...args: unknown[]) => finishVideoRender(...args)
}));
vi.mock('$lib/server/ai-log', () => ({
  withOrgContext: <T>(orgId: string, fn: () => T) => {
    withOrgContext(orgId);
    return fn();
  }
}));

function makeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));

  function build(name: string, mode: 'select' | 'update', patch?: Row) {
    const table = (tables[name] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let limit = Infinity;

    const run = () => {
      const hits = table.filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (mode === 'update') hits.forEach((r) => Object.assign(r, patch));
      return hits;
    };

    const api: Row = {
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), api),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
      not: (c: string, _op: string, p: string) => (filters.push((r) => !String(r[c]).startsWith(p.replace('%', ''))), api),
      like: (c: string, p: string) => (filters.push((r) => String(r[c]).startsWith(p.replace('%', ''))), api),
      lt: (c: string, v: string) => (filters.push((r) => r[c] != null && r[c] < v), api),
      order: () => api,
      limit: (n: number) => ((limit = n), api),
      select: () => api,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (res?: (v: { data: Row[]; error: null }) => unknown, rej?: (e: unknown) => unknown) => {
        try {
          const value = { data: run(), error: null };
          return Promise.resolve(res ? res(value) : value);
        } catch (e) {
          return rej ? Promise.resolve(rej(e)) : Promise.reject(e);
        }
      }
    };
    return api;
  }

  return {
    tables,
    client: {
      from: (name: string) => ({
        select: () => build(name, 'select'),
        update: (patch: Row) => build(name, 'update', patch),
        insert: (row: Row) => {
          const created = { id: `row-${(tables[name] ??= []).length + 1}`, ...row };
          tables[name].push(created);
          return { select: () => ({ maybeSingle: async () => ({ data: created, error: null }) }) };
        }
      })
    }
  };
}

function orgRow(over: Row = {}): Row {
  return {
    id: 'render-1',
    org_id: 'org-1',
    user_id: 'user-1',
    post_id: null,
    thread_id: null,
    task_id: 'kie-task-1',
    model: 'bytedance/seedance-2-5',
    status: 'rendering',
    duration_seconds: 8,
    resolution: '720p',
    cover_url: null,
    prompt: 'un gatto che salta',
    persist_opts: { captions: false, tighten: false },
    submitted_at: new Date(Date.now() - 30_000).toISOString(),
    attempts: 0,
    ...over
  };
}

async function reconcile(client: unknown) {
  const { reconcileVideoRenders } = await import('./video-render-queue');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return reconcileVideoRenders(client as any);
}

const LANDED = {
  status: 'done',
  url: 'https://cdn/clip.mp4',
  durationSeconds: 8,
  resolution: '720p'
};

beforeEach(() => {
  vi.clearAllMocks();
  finishVideoRender.mockResolvedValue(LANDED);
});

describe('un clip pagato da un\'organizzazione', () => {
  it('atterra sulla riga stessa: è lì che il clip si ritrova', async () => {
    const { tables, client } = makeDb({ video_renders: [orgRow()] });

    expect(await reconcile(client)).toMatchObject({ done: 1, failed: 0, expired: 0 });
    expect(tables.video_renders[0]).toMatchObject({
      status: 'done',
      media_url: 'https://cdn/clip.mp4'
    });
  });

  /**
   * IL TEST CHE CONTA. Lo scope decide dove finisce la riga di `ai_calls` che `finishVideoRender`
   * scrive: senza scope, `sum_org_ai_cost_usd` non la vede e il cancello dei
   * crediti passa per sempre su una spesa vera.
   */
  it('addebita all organizzazione, che è chi paga', async () => {
    const { client } = makeDb({ video_renders: [orgRow()] });

    await reconcile(client);

    expect(withOrgContext).toHaveBeenCalledWith('org-1');
  });

  it('un fallimento resta un fallimento, con il motivo scritto sulla riga', async () => {
    finishVideoRender.mockResolvedValue({ status: 'failed', error: 'kie ha rifiutato' });
    const { tables, client } = makeDb({ video_renders: [orgRow()] });

    expect(await reconcile(client)).toMatchObject({ failed: 1 });
    expect(tables.video_renders[0]).toMatchObject({ status: 'failed', error: 'kie ha rifiutato' });
  });
});

describe('submitAndTrackVideoRender', () => {
  async function track(client: unknown, owner: { orgId?: string }) {
    const { submitAndTrackVideoRender } = await import('./video-render-queue');
    return submitAndTrackVideoRender({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin: client as any,
      ...owner,
      userId: 'user-1',
      imagePrompt: 'un gatto',
      render: {}
    });
  }

  it('scrive l organizzazione', async () => {
    const { tables, client } = makeDb({ video_renders: [] });

    await track(client, { orgId: 'org-1' });

    expect(tables.video_renders[0]).toMatchObject({ org_id: 'org-1', task_id: 'kie-task-9' });
  });
});
