import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { OnboardingStatus } from '$lib/onboarding/coach';
import { firstRunFor, runDemo, type FirstRunDeps } from './first-run';

const db = {} as Db;

const node = (id: string, type: string) => ({ id, type, data: { prompt: 'p' }, version: 1 });
const wire = (source: string, target: string) => ({ sourceNodeId: source, targetNodeId: target });

function deps(over: Partial<Record<keyof FirstRunDeps, unknown>> = {}) {
  return {
    readFirstRun: vi.fn(async () => ({ signupCampaign: null, onboardingStatus: null })),
    moveOnboarding: vi.fn(async () => true),
    hasAnyRun: vi.fn(async () => false),
    listNodes: vi.fn(async () => [node('t', 'text'), node('i', 'image'), node('v', 'video')]),
    listConnections: vi.fn(async () => [wire('t', 'i'), wire('i', 'v')]),
    patchNodeData: vi.fn(async (_db: Db, input: { nodeId: string }) => ({ outcome: 'written', node: { id: input.nodeId } })),
    ...over
  } as unknown as FirstRunDeps & Record<keyof FirstRunDeps, ReturnType<typeof vi.fn>>;
}

afterEach(() => vi.unstubAllGlobals());

describe('the coach state lives on the profile', () => {
  it('a fresh user on an empty canvas starts it, once', async () => {
    const d = deps();

    const run = await firstRunFor(db, { userId: 'u1', orgId: 'o1', nodeCount: 0 }, d);

    expect(run).toEqual({ visible: true, started: true, hasGenerated: false });
    expect(d.moveOnboarding).toHaveBeenCalledWith(db, 'u1', { from: null, to: OnboardingStatus.Active });
  });

  it('a user who came with a campaign never sees it', async () => {
    const d = deps({ readFirstRun: vi.fn(async () => ({ signupCampaign: 'claymation-ai', onboardingStatus: null })) });

    expect(await firstRunFor(db, { userId: 'u1', orgId: 'o1', nodeCount: 3 }, d)).toEqual({ visible: false, started: false, hasGenerated: false });
    expect(d.moveOnboarding).not.toHaveBeenCalled();
  });

  it('an active coach closes for good once the user generated for real', async () => {
    const d = deps({
      readFirstRun: vi.fn(async () => ({ signupCampaign: null, onboardingStatus: OnboardingStatus.Active })),
      hasAnyRun: vi.fn(async () => true)
    });

    expect(await firstRunFor(db, { userId: 'u1', orgId: 'o1', nodeCount: 3 }, d)).toEqual({ visible: false, started: false, hasGenerated: true });
    expect(d.moveOnboarding).toHaveBeenCalledWith(db, 'u1', { from: OnboardingStatus.Active, to: OnboardingStatus.Completed });
  });
});

describe('the demo run spends nothing', () => {
  it('marks the three chained nodes as showing the example, with no provider call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const d = deps();

    const out = await runDemo(db, { orgId: 'o1', canvasId: 'c1', actor: { kind: 'user', id: 'u1' } }, d);

    expect(out?.map((n) => n.id)).toEqual(['t', 'i', 'v']);
    expect(d.patchNodeData).toHaveBeenCalledTimes(3);
    for (const call of d.patchNodeData.mock.calls) {
      expect(call[1].patch).toEqual({ example: true });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(d.hasAnyRun).not.toHaveBeenCalled();
  });

  it('refuses when the chain is not complete', async () => {
    const d = deps({ listConnections: vi.fn(async () => [wire('t', 'i')]) });

    expect(await runDemo(db, { orgId: 'o1', canvasId: 'c1', actor: { kind: 'user', id: 'u1' } }, d)).toBeNull();
    expect(d.patchNodeData).not.toHaveBeenCalled();
  });
});
