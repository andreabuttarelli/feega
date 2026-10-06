import type { PlanKey } from '$lib/plans';
import type { Actor } from '$lib/server/repos/actor';
import type { AudioFile } from '$lib/server/canvas/audio-provider';
import { ProjectMode } from '$lib/project-mode';
import {
  cloneRefusal,
  slotsLeft,
  VOICE_CREATION_USD,
  VOICE_SLOTS_BY_PLAN,
  type CloneRequest,
  type ConsentBasis,
  type VoiceMethod,
  type VoiceRefusal
} from '$lib/canvas/voices';
import type { DesignedPreview, VoiceProvider } from './voice-provider';

export const VOICE_ORG_LABEL = 'feega_org';

export type CustomVoice = {
  id: string;
  orgId: string;
  providerVoiceId: string;
  name: string;
  method: VoiceMethod;
  previewUrl: string | null;
  createdAt: string;
};

export type NewVoice = {
  orgId: string;
  providerVoiceId: string;
  name: string;
  method: VoiceMethod;
  description: string | null;
  consentBasis: ConsentBasis | null;
  consentSpeaker: string | null;
  consentAttestedAt: string | null;
  actor: Actor;
};

export type VoiceStore = {
  list(orgId: string): Promise<CustomVoice[]>;
  insert(row: NewVoice): Promise<CustomVoice>;
  remove(orgId: string, id: string): Promise<void>;
  ownedElsewhere(orgId: string, providerVoiceId: string): Promise<boolean>;
  unpurgedClones(): Promise<CustomVoice[]>;
  markSamplesPurged(id: string): Promise<void>;
  allProviderIds(): Promise<Set<string>>;
};

export type VoiceBill = { orgId: string; userId: string; actor: Actor; method: VoiceMethod; costUsd: number | null; ok: boolean; error?: string; ms: number };

export type VoiceDeps = { store: VoiceStore; provider: VoiceProvider; bill: (entry: VoiceBill) => void; plan: PlanKey | null };

export type VoiceScope = { orgId: string; userId: string; actor: Actor };

export type Outcome<T> = ({ ok: true } & T) | { ok: false; error: VoiceRefusal | 'voice_not_found' };

export async function voiceSlots(deps: VoiceDeps, orgId: string): Promise<{ used: number; quota: number; left: number }> {
  const [mine, account] = await Promise.all([deps.store.list(orgId), deps.provider.slots()]);
  const used = mine.length;
  return { used, quota: VOICE_SLOTS_BY_PLAN[deps.plan ?? 'none'], left: slotsLeft({ plan: deps.plan, used, account }) };
}

async function slotsFull(deps: VoiceDeps, orgId: string): Promise<boolean> {
  return (await voiceSlots(deps, orgId)).left <= 0;
}

async function billed<T>(deps: VoiceDeps, scope: VoiceScope, method: VoiceMethod, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const base = { orgId: scope.orgId, userId: scope.userId, actor: scope.actor, method };
  try {
    const out = await work();
    deps.bill({ ...base, costUsd: VOICE_CREATION_USD[method], ok: true, ms: Date.now() - startedAt });
    return out;
  } catch (error) {
    deps.bill({ ...base, costUsd: null, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - startedAt });
    throw error;
  }
}

async function recorded(deps: VoiceDeps, row: NewVoice): Promise<CustomVoice> {
  try {
    return await deps.store.insert(row);
  } catch (error) {
    await deps.provider.remove(row.providerVoiceId).catch(() => undefined);
    throw error;
  }
}

export async function designPreviews(deps: VoiceDeps, scope: VoiceScope, input: { description: string }): Promise<Outcome<{ previews: DesignedPreview[] }>> {
  if (await slotsFull(deps, scope.orgId)) {
    return { ok: false, error: 'voice_slots_full' };
  }
  const previews = await billed(deps, scope, 'design', () => deps.provider.design(input));
  return { ok: true, previews };
}

export async function saveDesignedVoice(
  deps: VoiceDeps,
  scope: VoiceScope,
  input: { generatedVoiceId: string; name: string; description: string }
): Promise<Outcome<{ voice: CustomVoice }>> {
  if (await slotsFull(deps, scope.orgId)) {
    return { ok: false, error: 'voice_slots_full' };
  }
  const providerVoiceId = await deps.provider.saveDesign({ ...input, labels: { [VOICE_ORG_LABEL]: scope.orgId } });
  const voice = await recorded(deps, {
    orgId: scope.orgId,
    providerVoiceId,
    name: input.name,
    method: 'design',
    description: input.description,
    consentBasis: null,
    consentSpeaker: null,
    consentAttestedAt: null,
    actor: scope.actor
  });
  return { ok: true, voice };
}

async function purgeSamples(deps: VoiceDeps, voice: CustomVoice): Promise<void> {
  for (const sampleId of await deps.provider.sampleIds(voice.providerVoiceId)) {
    await deps.provider.deleteSample(voice.providerVoiceId, sampleId);
  }
  await deps.store.markSamplesPurged(voice.id);
}

export async function cloneVoice(
  deps: VoiceDeps,
  scope: VoiceScope,
  input: CloneRequest & { name: string; samples: AudioFile[] }
): Promise<Outcome<{ voice: CustomVoice }>> {
  const refusal = cloneRefusal(input);
  if (refusal) {
    return { ok: false, error: refusal };
  }
  if (await slotsFull(deps, scope.orgId)) {
    return { ok: false, error: 'voice_slots_full' };
  }

  const providerVoiceId = await billed(deps, scope, 'instant_clone', () =>
    deps.provider.clone({ name: input.name, samples: input.samples, labels: { [VOICE_ORG_LABEL]: scope.orgId } })
  );
  const voice = await recorded(deps, {
    orgId: scope.orgId,
    providerVoiceId,
    name: input.name,
    method: 'instant_clone',
    description: null,
    consentBasis: input.consentBasis,
    consentSpeaker: input.consentBasis === 'consented_speaker' ? input.speaker.trim() : null,
    consentAttestedAt: new Date().toISOString(),
    actor: scope.actor
  });

  await purgeSamples(deps, voice).catch((error) => console.warn('[voices] samples left for the sweep', voice.id, error instanceof Error ? error.message : error));
  return { ok: true, voice };
}

export async function deleteVoice(deps: VoiceDeps, orgId: string, id: string): Promise<Outcome<object>> {
  const voice = (await deps.store.list(orgId)).find((v) => v.id === id);
  if (!voice) {
    return { ok: false, error: 'voice_not_found' };
  }
  await deps.provider.remove(voice.providerVoiceId);
  await deps.store.remove(orgId, id);
  return { ok: true };
}

export async function purgeVoiceSamples(deps: VoiceDeps): Promise<{ purged: number; failed: number }> {
  const tally = { purged: 0, failed: 0 };
  for (const voice of await deps.store.unpurgedClones()) {
    try {
      await purgeSamples(deps, voice);
      tally.purged += 1;
    } catch {
      tally.failed += 1;
    }
  }
  return tally;
}

export async function sweepOrphanVoices(deps: VoiceDeps): Promise<{ removed: number }> {
  const [ours, known] = await Promise.all([deps.provider.labelled(VOICE_ORG_LABEL), deps.store.allProviderIds()]);
  const orphans = ours.filter((v) => !known.has(v.voiceId));
  for (const orphan of orphans) {
    await deps.provider.remove(orphan.voiceId);
  }
  return { removed: orphans.length };
}

export async function voiceRefusalFor(
  store: VoiceStore,
  input: { orgId: string; voiceId: string; mode: ProjectMode }
): Promise<VoiceRefusal | null> {
  if (await store.ownedElsewhere(input.orgId, input.voiceId)) {
    return 'voice_not_yours';
  }
  if (input.mode !== ProjectMode.Uncensored) {
    return null;
  }
  const own = (await store.list(input.orgId)).find((v) => v.providerVoiceId === input.voiceId);
  return own?.method === 'instant_clone' ? 'cloned_voice_not_in_this_project' : null;
}

export async function sweepVoices(deps: VoiceDeps, now: Date): Promise<{ samples: { purged: number; failed: number }; orphans: { removed: number } }> {
  const samples = await purgeVoiceSamples(deps);
  const orphans = now.getUTCMinutes() === 0 ? await sweepOrphanVoices(deps) : { removed: 0 };
  return { samples, orphans };
}
