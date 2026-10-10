import { embedSource, isSourceEmbed, legacyFingerprint, revisionFingerprint, type InteractiveInput } from '$lib/motion/interactive/bundle';
import type { MotionDoc } from '$lib/motion/doc';
import { embedRefusal } from '$lib/gallery/refusals';
import type { ProjectMode } from '$lib/project-mode';

export enum RebuildOutcome {
  Rebuilt = 'rebuilt',
  Ready = 'ready',
  Current = 'current',
  Unpublished = 'unpublished',
  Unreadable = 'unreadable',
  NoNode = 'no_node',
  Deleted = 'deleted',
  Refused = 'refused',
  NoRevision = 'no_revision',
  Mismatch = 'mismatch',
  Busy = 'busy',
  Changed = 'changed',
  Failed = 'failed'
}

export type StoredEmbed = { page: string; updatedAt: string };
export type EmbedPlace = { orgId: string; projectId: string; canvasId: string; brandId: string | null; title: string; mode: ProjectMode; deleted: boolean };
export type RebuildInput = Omit<InteractiveInput, 'settings'>;

export type RebuildPorts = {
  stored(id: string): Promise<StoredEmbed | null>;
  place(id: string): Promise<EmbedPlace | null>;
  revisionAt(place: EmbedPlace, id: string, at: string): Promise<MotionDoc | null>;
  input(place: EmbedPlace, doc: MotionDoc): Promise<RebuildInput>;
  claim(id: string): Promise<boolean>;
  release(id: string): Promise<void>;
  write(id: string, html: string): Promise<boolean>;
};

export type RebuildPlan = { outcome: Exclude<RebuildOutcome, RebuildOutcome.Ready> } | { outcome: RebuildOutcome.Ready; input: RebuildInput; updatedAt: string };

const stop = (outcome: Exclude<RebuildOutcome, RebuildOutcome.Ready>): RebuildPlan => ({ outcome });

export async function planRebuild(ports: RebuildPorts, id: string, origin: string): Promise<RebuildPlan> {
  const stored = await ports.stored(id);
  if (!stored) {
    return stop(RebuildOutcome.Unpublished);
  }
  if (isSourceEmbed(stored.page)) {
    return stop(RebuildOutcome.Current);
  }
  const published = legacyFingerprint(stored.page);
  if (!published) {
    return stop(RebuildOutcome.Unreadable);
  }

  const place = await ports.place(id);
  if (!place) {
    return stop(RebuildOutcome.NoNode);
  }
  if (place.deleted) {
    return stop(RebuildOutcome.Deleted);
  }
  if (embedRefusal(place.mode)) {
    return stop(RebuildOutcome.Refused);
  }

  const doc = await ports.revisionAt(place, id, stored.updatedAt);
  if (!doc) {
    return stop(RebuildOutcome.NoRevision);
  }
  const input = await ports.input(place, doc);
  if (revisionFingerprint(input, origin) !== published) {
    return stop(RebuildOutcome.Mismatch);
  }
  return { outcome: RebuildOutcome.Ready, input, updatedAt: stored.updatedAt };
}

async function writeIfUnchanged(ports: RebuildPorts, id: string, plan: Extract<RebuildPlan, { outcome: RebuildOutcome.Ready }>): Promise<RebuildOutcome> {
  const html = await embedSource(plan.input);
  const now = await ports.stored(id);
  if (!now || now.updatedAt !== plan.updatedAt || isSourceEmbed(now.page)) {
    return RebuildOutcome.Changed;
  }
  return (await ports.write(id, html)) ? RebuildOutcome.Rebuilt : RebuildOutcome.Failed;
}

export async function rebuildEmbed(ports: RebuildPorts, id: string, origin: string): Promise<RebuildOutcome> {
  const plan = await planRebuild(ports, id, origin);
  if (plan.outcome !== RebuildOutcome.Ready) {
    return plan.outcome;
  }
  if (!(await ports.claim(id))) {
    return RebuildOutcome.Busy;
  }

  const outcome = await writeIfUnchanged(ports, id, plan).catch(() => RebuildOutcome.Failed);
  if (outcome !== RebuildOutcome.Rebuilt) {
    await ports.release(id);
  }
  return outcome;
}
