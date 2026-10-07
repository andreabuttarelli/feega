import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { BROWSER_RENDER_PREFIX, type NodeRun } from '$lib/server/repos/node-runs';
import { LinkRefusal, RENDER_LINK_OPEN_MS } from '$lib/motion/render-link';
import { createRenderLink, hashOf, linkVerdict, parseToken } from './render-link';

const NOW = Date.parse('2026-10-07T10:00:00Z');
const ORG = 'org-1';
const NODE = 'node-1';
const USER = 'user-1';

function run(over: Partial<NodeRun> = {}, link: Record<string, unknown> = {}): NodeRun {
  return {
    id: 'run-1',
    orgId: ORG,
    nodeId: NODE,
    prompt: null,
    model: null,
    params: { kind: 'browser-render', revision: 4, link: { hash: hashOf('secret'), expiresAt: new Date(NOW + RENDER_LINK_OPEN_MS).toISOString(), claim: null, ...link } },
    status: 'running',
    error: null,
    outputAssetId: null,
    externalJobId: `${BROWSER_RENDER_PREFIX}4`,
    costUsd: null,
    attempts: 0,
    actorId: USER,
    startedAt: new Date(NOW).toISOString(),
    finishedAt: null,
    ...over
  };
}

describe('il token di render', () => {
  it('porta il run e un segreto, e niente altro si legge come token', () => {
    expect(parseToken('run-1.abc')).toEqual({ runId: 'run-1', secret: 'abc' });
    expect(parseToken('run-1')).toBeNull();
    expect(parseToken('')).toBeNull();
  });

  it('nasce come run in corso col solo hash del segreto, legato a revisione, org e utente', async () => {
    const row = { id: 'run-9', org_id: ORG, node_id: NODE, prompt: '', model: null, params: {}, status: 'running', error: null, output_asset_id: null, external_job_id: `${BROWSER_RENDER_PREFIX}4`, cost_usd: null, attempts: 0, actor_id: USER, started_at: '', finished_at: null };
    const { db, calls } = fakeDb({ node_runs: [row] });

    const link = await createRenderLink(db, { orgId: ORG, nodeId: NODE, version: 4, actor: { kind: 'agent', id: USER, agentKey: 'mcp' } }, NOW);

    const insert = calls.find((c) => c.op === 'insert')!.payload as { org_id: string; actor_id: string; external_job_id: string; params: { revision: number; link: { hash: string; claim: null } } };
    expect(insert).toMatchObject({ org_id: ORG, actor_id: USER, external_job_id: `${BROWSER_RENDER_PREFIX}4` });
    expect(insert.params.revision).toBe(4);
    expect(JSON.stringify(insert)).not.toContain(parseToken(link.token)!.secret);
    expect(insert.params.link.hash).toBe(hashOf(parseToken(link.token)!.secret));
    expect(link.expiresAt).toBe(new Date(NOW + RENDER_LINK_OPEN_MS).toISOString());
  });
});

describe('linkVerdict', () => {
  it('la prima apertura entro la scadenza passa e va reclamata', () => {
    expect(linkVerdict(run(), 'secret', null, NOW)).toEqual({ ok: true, fresh: true });
  });

  it('un segreto sbagliato è un link non valido', () => {
    expect(linkVerdict(run(), 'other', null, NOW)).toEqual({ ok: false, error: LinkRefusal.Invalid });
  });

  it('un run che non è un render nel browser non si apre con un token', () => {
    expect(linkVerdict(run({ externalJobId: 'motion-render:4' }), 'secret', null, NOW)).toEqual({ ok: false, error: LinkRefusal.Invalid });
  });

  it('scaduto prima di essere aperto', () => {
    expect(linkVerdict(run(), 'secret', null, NOW + RENDER_LINK_OPEN_MS + 1)).toEqual({ ok: false, error: LinkRefusal.Expired });
  });

  it('monouso: un run chiuso non si riapre', () => {
    for (const status of ['done', 'failed', 'expired'] as const) {
      expect(linkVerdict(run({ status }), 'secret', null, NOW)).toEqual({ ok: false, error: LinkRefusal.Used });
    }
  });

  it('reclamato: lo riapre solo il dispositivo che lo ha aperto, anche dopo la scadenza di apertura', () => {
    const claimed = run({}, { claim: hashOf('device-a') });
    expect(linkVerdict(claimed, 'secret', 'device-a', NOW + RENDER_LINK_OPEN_MS + 1)).toEqual({ ok: true, fresh: false });
    expect(linkVerdict(claimed, 'secret', 'device-b', NOW)).toEqual({ ok: false, error: LinkRefusal.Elsewhere });
    expect(linkVerdict(claimed, 'secret', null, NOW)).toEqual({ ok: false, error: LinkRefusal.Elsewhere });
  });
});
