import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { runGenNode } from './generate';
import { PEOPLE_REFUSAL, PeopleVerdict, type Reference } from '$lib/server/moderation/people';
import type { WiroModel, WiroRunDeps } from './wiro-run';
import type { ScreenPorts } from '$lib/server/moderation/screen';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const RUN = '33333333-3333-3333-3333-333333333333';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';
const INFLUENCER_NODE = '77777777-7777-7777-7777-777777777777';

const UNCENSORED = 'wiro/wiro-partners/z-image-uncensored';
const SAFE = 'wiro/alibaba/qwen-image-3-0-pro';

const models: Record<string, WiroModel> = {
  [UNCENSORED]: {
    id: UNCENSORED,
    catalogue: 'image',
    uncensored: true,
    spec: { owner: 'wiro-partners', project: 'z-image-uncensored', fields: { prompt: 'prompt', aspectRatio: 'ratio', images: [] } },
    paramSchema: { aspect_ratio: { type: 'enum', values: ['1:1'] }, promptExtend: { type: 'enum', values: ['false', 'true'] } }
  },
  [SAFE]: {
    id: SAFE,
    catalogue: 'image',
    uncensored: false,
    spec: { owner: 'alibaba', project: 'qwen-image-3-0-pro', fields: { prompt: 'prompt', images: ['inputImage'] } },
    paramSchema: {}
  }
};

const gateway = { run: vi.fn(), task: vi.fn(), purge: vi.fn() };
const bill = vi.fn();
const decide = vi.fn();
const judge = vi.fn();
const decideIdentifiability = vi.fn();
const judgeIdentifiability = vi.fn();
const record = vi.fn();
const screen: ScreenPorts = { decide, judge, decideIdentifiability, judgeIdentifiability, record };

const { deps } = vi.hoisted(() => ({ deps: { current: null as null | ((db: Db) => WiroRunDeps) } }));
vi.mock('$lib/server/wiro-config', () => ({ wiroRunDeps: (db: Db) => deps.current!(db) }));
vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: { UNCENSORED_DEV_MANUAL_VERIFICATION: 'true' } }));
vi.mock('./node-model', () => ({ resolveNodeModel: async (_m: string, model: string | null) => ({ ok: true, model }) }));
const { refs, detect } = vi.hoisted(() => ({ refs: { images: [] as string[] }, detect: { verdict: (_r: { url: string }) => Promise.resolve('absent') } }));
vi.mock('./sign-media', () => ({ signMediaPaths: async (_db: unknown, paths: string[]) => paths.map((p) => `https://signed/${p}`) }));
vi.mock('$lib/server/moderation/moderation-config', () => ({ peopleDetector: () => (r: { url: string }) => detect.verdict(r) }));
vi.mock('$lib/server/canvas/upstream', () => ({
  upstreamInputsFor: async () => ({
    text: [],
    referenceImageUrl: refs.images[0] ?? null,
    referenceImageUrls: refs.images,
    pickedImageUrls: [],
    referenceVideoUrls: [],
    referenceAudioUrls: [],
    startFrameUrl: null,
    endFrameUrl: null,
    blocked: null,
    rejected: []
  })
}));

beforeEach(async () => {
  for (const fn of [gateway.run, gateway.task, bill, decide, judge, decideIdentifiability, judgeIdentifiability, record]) {
    fn.mockReset();
  }
  decide.mockResolvedValue({ choice: 'safe', probabilities: { safe: 0.999 } });
  decideIdentifiability.mockResolvedValue({ choice: 'generic', probabilities: { generic: 0.999 } });
  judgeIdentifiability.mockResolvedValue({ allowed: true, category: 'generic', reason: '' });
  gateway.run.mockResolvedValue({ taskId: '2221' });
  const { uncensoredAccess } = await import('$lib/server/uncensored-access');
  deps.current = (db) => ({
    gateway,
    model: async (id) => models[id] ?? null,
    access: (orgId) => uncensoredAccess(db, orgId),
    screen: () => screen,
    refuseLikeness: (_scope, _model, reason) => record({ stage: 'rules', verdict: 'refuse', reason }),
    bill
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })));
});

const imageNode = (data: Record<string, unknown> = {}) => ({
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type: 'image',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

const start = (model: string, prompt: string, params: Record<string, unknown> = {}) => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium: 'image' as const,
  prompt,
  model,
  params,
  expectedVersion: 1
});

const paidOrg = { id: ORG, stripe_subscription_id: 'sub_1' };
const optIn = { org_id: ORG, enabled_by: USER, enabled_at: '2026-09-29T10:00:00Z', disabled_at: null };
const uncensoredProject = { id: PROJECT, org_id: ORG, mode: 'uncensored' };
const verified = { id: 'v1', user_id: USER, provider: 'manual_admin', method: 'manual_admin', result: 'adult' };

function canvas(extra: Record<string, unknown[]> = {}) {
  return fakeDb(
    {
      nodes: [imageNode()],
      nodes_connections: [],
      assets: [],
      orgs: [paidOrg],
      org_uncensored_optins: [optIn],
      projects: [uncensoredProject],
      user_age_verifications: [verified],
      ...extra
    },
    { updateRows: { nodes: [{ ...imageNode(), version: 2 }] } }
  );
}


describe('a reference with people in an uncensored project', () => {
  beforeEach(() => {
    refs.images = [];
  });

  it('is refused before the provider is called, and the node shows why', async () => {
    refs.images = ['org/person.png'];
    detect.verdict = async (r) => (r.url.includes('person') ? PeopleVerdict.Present : PeopleVerdict.Absent);
    const { db, calls } = canvas();

    const out = await runGenNode(db, start(SAFE, 'make it moody'));

    expect(out).toEqual({ kind: 'refused', error: PEOPLE_REFUSAL });
    expect(gateway.run).not.toHaveBeenCalled();
    const node = calls.filter((c) => c.table === 'nodes' && c.op === 'update').pop()?.payload as { data?: { error?: string } } | undefined;
    expect(node?.data?.error).toBe(PEOPLE_REFUSAL);
  });

  it('is refused when the detector is down', async () => {
    refs.images = ['org/lake.png'];
    detect.verdict = async () => Promise.reject(new Error('down'));
    const { db } = canvas();

    expect(await runGenNode(db, start(SAFE, 'make it moody'))).toMatchObject({ kind: 'refused' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('lets a reference without people through to the provider', async () => {
    refs.images = ['org/lake.png'];
    const seen: Reference[] = [];
    detect.verdict = async (r) => {
      seen.push(r as Reference);
      return PeopleVerdict.Absent;
    };
    const { db } = canvas();

    await runGenNode(db, start(SAFE, 'make it moody'));

    expect(seen.map((r) => r.url)).toEqual(['https://signed/org/lake.png']);
    expect(gateway.run).toHaveBeenCalled();
  });

  it('never asks the detector in a standard project', async () => {
    refs.images = ['org/person.png'];
    const asked = vi.fn(async () => PeopleVerdict.Present);
    detect.verdict = asked;
    const { db } = canvas({ projects: [{ ...uncensoredProject, mode: 'standard' }] });

    await runGenNode(db, start(SAFE, 'make it moody'));

    expect(asked).not.toHaveBeenCalled();
  });
});
