import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, findNode, patchNodeData } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import { videoSpentUsd } from '$lib/server/repos/video-spend';
import { FIX_RESERVE_SHARE, VIDEO_CAPS, VIDEO_RAISE_USD } from '$lib/server/project-agent/limits';
import { VideoKind } from '$lib/motion/replica';
import type { BudgetCard } from '$lib/motion/budget-card';

export { VIDEO_BUDGET, type BudgetCard } from '$lib/motion/budget-card';

const MIN_STEP_USD = 0.05;
const RAISE_ATTEMPTS = 3;

export type VideoBudget = { spentUsd: number; capUsd: number; kind: VideoKind };

type NodeScope = { orgId: string; nodeId: string };

export const videoBudget = (spentUsd: number, raisedUsd: number, kind = VideoKind.Standard): VideoBudget => ({ spentUsd, capUsd: VIDEO_CAPS[kind].videoUsd + raisedUsd, kind });

export enum Reserve {
  Kept = 'kept',
  Drawn = 'drawn'
}

const RESERVED_SHARE: Record<Reserve, number> = { [Reserve.Kept]: FIX_RESERVE_SHARE, [Reserve.Drawn]: 0 };

const leftUsd = (budget: VideoBudget, reserve: Reserve) => Math.max(0, budget.capUsd - VIDEO_CAPS[budget.kind].videoUsd * RESERVED_SHARE[reserve] - budget.spentUsd);

export const turnBudgetUsd = (budget: VideoBudget, reserve = Reserve.Drawn) => Math.min(VIDEO_CAPS[budget.kind].turnUsd, leftUsd(budget, reserve));

export const budgetSpent = (budget: VideoBudget, reserve = Reserve.Drawn) => leftUsd(budget, reserve) < MIN_STEP_USD;

const cents = (usd: number) => Math.round(usd * 100) / 100;

export const budgetCard = (budget: VideoBudget): BudgetCard => ({ ok: true, spent_usd: cents(budget.spentUsd), cap_usd: cents(budget.capUsd), raise_usd: VIDEO_RAISE_USD });

export const budgetNote = (card: BudgetCard) =>
  `This video has used its budget: $${card.spent_usd.toFixed(2)} spent so far. The work is saved. Continue to give it another $${card.raise_usd.toFixed(2)}.`;

export async function readVideoBudget(db: Db, scope: NodeScope, raisedUsd: number, kind = VideoKind.Standard): Promise<VideoBudget> {
  return videoBudget(await videoSpentUsd(db, scope), raisedUsd, kind);
}

export async function raiseVideoBudget(db: Db, scope: NodeScope & { actor?: Actor }): Promise<VideoBudget | null> {
  for (let attempt = 0; attempt < RAISE_ATTEMPTS; attempt++) {
    const record = await findNode(db, scope);
    const motion = record ? motionOf(record) : null;
    if (!record || !motion) {
      return null;
    }
    const raised = motion.budgetRaisedUsd ?? 0;
    const base = record.data.budgetRaisedUsd === undefined ? {} : { budgetRaisedUsd: raised };
    const written = await patchNodeData(db, { orgId: scope.orgId, nodeId: scope.nodeId, patch: { budgetRaisedUsd: raised + VIDEO_RAISE_USD }, base, check: DataCheck.Schema, actor: scope.actor });
    if (written.outcome === 'gone') {
      return null;
    }
    if (written.outcome === 'written') {
      return readVideoBudget(db, scope, raised + VIDEO_RAISE_USD, motion.videoKind);
    }
  }
  return null;
}
