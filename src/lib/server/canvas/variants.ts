import type { Db } from '$lib/server/db/client';
import { allowlistRefusal } from '$lib/server/model-allowlist/allowlist';
import { capRefusal, liveCapReader } from '$lib/server/spend-caps/gate';
import { createConnection, createNode, findNode, listConnections, patchNodeData, DataCheck, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { failRun, runningRuns } from '$lib/server/repos/node-runs';
import { canvasModeOf } from '$lib/server/uncensored-workspace/workspace-server';
import { VARIANT_GROUP_PARAM, VARIANT_SOURCE_PARAM, runGenNode, type RunOutcome, type StartRun } from './generate';
import { resolveModelIn } from './node-model';
import { estimateLoopCredits } from './loop-cost';
import { creditsCover } from './credits-cover';
import { VariantInto, variantCap, variantLayout } from '$lib/canvas/variants';
import type { GenParams } from '$lib/canvas/gen-node';

const CANCELLED = 'cancelled';
const RUNNING_RUNS_SCAN = 500;
const SIZE_FALLBACK = { width: 360, height: 360 };
const VARIANT_PARAMS = ['variants', 'variantsInto', 'repeat'] as const;
const INHERITED_DATA = ['references'] as const;

export type VariantsAsk = StartRun & { count: number; into: VariantInto };

export type VariantsOutcome =
  | { kind: 'variants'; into: VariantInto; group: string; nodeIds: string[]; runs: RunOutcome[]; credits: number | null }
  | { kind: 'refused'; error: string }
  | { kind: 'conflict' };

export type GenerationOutcome = RunOutcome | VariantsOutcome;

type Prepared = { group: string; credits: number | null };

function plainRun(ask: VariantsAsk): StartRun {
  const { count: _count, into: _into, ...run } = ask;
  return run;
}

function paramsWithoutVariants(params: GenParams): GenParams {
  const kept: Record<string, unknown> = { ...params };
  for (const key of VARIANT_PARAMS) {
    delete kept[key];
  }
  return kept as GenParams;
}

async function refusalBeforeSpend(db: Db, ask: VariantsAsk): Promise<{ error: string } | Prepared> {
  if (variantCap(ask.medium) < ask.count) {
    return { error: variantCap(ask.medium) === 1 ? 'variants_unsupported' : 'too_many_variants' };
  }

  const mode = await canvasModeOf(db, { orgId: ask.orgId, canvasId: ask.canvasId });
  const pick = await resolveModelIn(mode, ask.medium, ask.model, ask.params);
  if (!pick.ok) {
    return { error: pick.error };
  }

  const notAllowed = await allowlistRefusal(db, { orgId: ask.orgId, medium: ask.medium, model: pick.model });
  if (notAllowed) {
    return { error: notAllowed };
  }

  const capped = await capRefusal(await liveCapReader(db), { orgId: ask.orgId, userId: ask.userId, projectId: ask.projectId });
  if (capped) {
    return { error: capped };
  }

  const quote = estimateLoopCredits({ medium: ask.medium, model: pick.model, count: ask.count });
  if (!(await creditsCover(ask.orgId, quote.total))) {
    return { error: 'credits_exhausted' };
  }
  return { group: crypto.randomUUID(), credits: quote.total };
}

async function copyInputs(db: Db, ask: VariantsAsk, from: string, to: string): Promise<void> {
  const wires = (await listConnections(db, { orgId: ask.orgId, canvasId: ask.canvasId })).filter((c) => c.targetNodeId === from);
  await Promise.all(
    wires.map((w) =>
      createConnection(db, {
        orgId: ask.orgId,
        canvasId: ask.canvasId,
        sourceNodeId: w.sourceNodeId,
        targetNodeId: to,
        sourceHandle: w.sourceHandle,
        targetHandle: w.targetHandle,
        mode: w.mode,
        actor: ask.actor
      })
    )
  );
}

async function spawnSiblings(db: Db, ask: VariantsAsk, source: CanvasNodeRecord): Promise<CanvasNodeRecord[]> {
  const size = { width: source.size.width ?? SIZE_FALLBACK.width, height: source.size.height ?? SIZE_FALLBACK.height };
  const spots = variantLayout({ x: source.position.x, y: source.position.y, ...size }, ask.count);
  const inherited = Object.fromEntries(INHERITED_DATA.filter((key) => key in source.data).map((key) => [key, source.data[key]]));
  const data = { ...inherited, params: paramsWithoutVariants(ask.params), prompt: ask.prompt, model: ask.model };

  return Promise.all(
    spots.map(async (spot) => {
      const made = await createNode(db, {
        orgId: ask.orgId,
        projectId: ask.projectId,
        canvasId: ask.canvasId,
        type: source.type,
        x: spot.x,
        y: spot.y,
        width: size.width,
        height: size.height,
        displayName: source.displayName,
        data,
        actor: ask.actor
      });
      await copyInputs(db, ask, source.id, made.id);
      return made;
    })
  );
}

async function intoNodes(db: Db, ask: VariantsAsk, source: CanvasNodeRecord, prepared: Prepared): Promise<VariantsOutcome> {
  const siblings = await spawnSiblings(db, ask, source);
  const runs = await Promise.all(
    siblings.map((sibling) =>
      runGenNode(db, {
        ...plainRun(ask),
        nodeId: sibling.id,
        params: paramsWithoutVariants(ask.params),
        expectedVersion: sibling.version,
        variants: { group: prepared.group, source: source.id, sharesNode: false }
      })
    )
  );
  return { kind: 'variants', into: VariantInto.Nodes, group: prepared.group, nodeIds: siblings.map((s) => s.id), runs, credits: prepared.credits };
}

async function intoHistory(db: Db, ask: VariantsAsk, source: CanvasNodeRecord, prepared: Prepared): Promise<VariantsOutcome> {
  const runs = await Promise.all(
    Array.from({ length: ask.count }, () =>
      runGenNode(db, { ...plainRun(ask), variants: { group: prepared.group, source: source.id, sharesNode: true } })
    )
  );
  return { kind: 'variants', into: VariantInto.History, group: prepared.group, nodeIds: [source.id], runs, credits: prepared.credits };
}

const DESTINATIONS: Record<VariantInto, typeof intoNodes> = {
  [VariantInto.Nodes]: intoNodes,
  [VariantInto.History]: intoHistory
};

export async function runGeneration(db: Db, ask: VariantsAsk): Promise<GenerationOutcome> {
  if (ask.count <= 1) {
    return runGenNode(db, plainRun(ask));
  }

  const source = await findNode(db, { orgId: ask.orgId, nodeId: ask.nodeId });
  if (!source) {
    return { kind: 'refused', error: 'node_not_found' };
  }
  if (ask.into === VariantInto.History && source.version !== ask.expectedVersion) {
    return { kind: 'conflict' };
  }

  const prepared = await refusalBeforeSpend(db, ask);
  if ('error' in prepared) {
    return { kind: 'refused', error: prepared.error };
  }
  return DESTINATIONS[ask.into](db, ask, source, prepared);
}

export type CancelOutcome = { cancelled: number };

export async function cancelVariants(db: Db, scope: { orgId: string; nodeId: string }): Promise<CancelOutcome> {
  const running = await runningRuns(db, { limit: RUNNING_RUNS_SCAN });
  const batch = running.filter((run) => run.orgId === scope.orgId && run.params[VARIANT_SOURCE_PARAM] === scope.nodeId && run.params[VARIANT_GROUP_PARAM]);

  await Promise.all(batch.map((run) => failRun(db, { orgId: scope.orgId, runId: run.id, error: CANCELLED })));
  const nodeIds = [...new Set(batch.map((run) => run.nodeId))];
  await Promise.all(
    nodeIds.map((nodeId) =>
      patchNodeData(db, { orgId: scope.orgId, nodeId, patch: { running: false, error: null }, check: DataCheck.None }).catch(() => null)
    )
  );
  return { cancelled: batch.length };
}
