import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, listConnections, listNodes, patchNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { hasAnyRun } from '$lib/server/repos/node-runs';
import { moveOnboarding, readFirstRun } from '$lib/server/repos/profiles';
import { OnboardingStatus, chainOf, coachVisible, shouldStart } from '$lib/onboarding/coach';

export type FirstRunDeps = {
  readFirstRun: typeof readFirstRun;
  moveOnboarding: typeof moveOnboarding;
  hasAnyRun: typeof hasAnyRun;
  listNodes: typeof listNodes;
  listConnections: typeof listConnections;
  patchNodeData: typeof patchNodeData;
};

const FIRST_RUN_DEPS: FirstRunDeps = { readFirstRun, moveOnboarding, hasAnyRun, listNodes, listConnections, patchNodeData };

export type FirstRun = { visible: boolean; started: boolean; hasGenerated: boolean };

export async function firstRunFor(
  db: Db,
  who: { userId: string; orgId: string; nodeCount: number },
  deps: FirstRunDeps = FIRST_RUN_DEPS
): Promise<FirstRun> {
  const [profile, hasGenerated] = await Promise.all([deps.readFirstRun(db, who.userId), deps.hasAnyRun(db, who.orgId)]);
  const eligibility = { status: profile.onboardingStatus, signupCampaign: profile.signupCampaign, nodeCount: who.nodeCount, hasGenerated };

  if (shouldStart(eligibility)) {
    const started = await deps.moveOnboarding(db, who.userId, { from: null, to: OnboardingStatus.Active });
    return { visible: started, started, hasGenerated };
  }

  if (profile.onboardingStatus === OnboardingStatus.Active && hasGenerated) {
    await deps.moveOnboarding(db, who.userId, { from: OnboardingStatus.Active, to: OnboardingStatus.Completed });
  }

  return { visible: coachVisible({ status: profile.onboardingStatus, hasGenerated }), started: false, hasGenerated };
}

export async function endOnboarding(db: Db, userId: string, to: OnboardingStatus, deps: Pick<FirstRunDeps, 'moveOnboarding'> = FIRST_RUN_DEPS): Promise<boolean> {
  return deps.moveOnboarding(db, userId, { from: OnboardingStatus.Active, to });
}

export async function runDemo(
  db: Db,
  scope: { orgId: string; canvasId: string; actor: Actor },
  deps: FirstRunDeps = FIRST_RUN_DEPS
): Promise<CanvasNodeRecord[] | null> {
  const [nodes, connections] = await Promise.all([deps.listNodes(db, scope), deps.listConnections(db, scope)]);
  const chain = chainOf({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, example: n.data.example === true })),
    edges: connections.map((c) => ({ source: c.sourceNodeId, target: c.targetNodeId }))
  });
  if (!chain.text || !chain.image || !chain.video) {
    return null;
  }

  const written: CanvasNodeRecord[] = [];
  for (const nodeId of [chain.text, chain.image, chain.video]) {
    const out = await deps.patchNodeData(db, { orgId: scope.orgId, nodeId, patch: { example: true }, check: DataCheck.Schema, actor: scope.actor });
    if (out.outcome === 'written') {
      written.push(out.node);
    }
  }
  return written;
}
