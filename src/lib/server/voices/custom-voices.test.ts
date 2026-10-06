import { describe, expect, it, vi } from 'vitest';
import {
  cloneVoice,
  deleteVoice,
  designPreviews,
  purgeVoiceSamples,
  saveDesignedVoice,
  sweepOrphanVoices,
  sweepVoices,
  voiceRefusalFor,
  voiceSlots,
  VOICE_ORG_LABEL,
  type CustomVoice,
  type VoiceDeps,
  type VoiceStore
} from './custom-voices';
import { CLONE_MIN_SECONDS, VOICE_CREATION_USD, VOICE_SLOTS_BY_PLAN } from '$lib/canvas/voices';
import { ProjectMode } from '$lib/project-mode';
import type { VoiceProvider } from './voice-provider';

const SCOPE = { orgId: 'org-1', userId: 'u1', actor: { kind: 'user' as const, id: 'u1' } };
const SAMPLE = { bytes: new Uint8Array([1, 2]), mime: 'audio/webm' };

function voice(over: Partial<CustomVoice> = {}): CustomVoice {
  return { id: 'row-1', orgId: 'org-1', providerVoiceId: 'el-1', name: 'Mine', method: 'design', previewUrl: null, createdAt: 'now', ...over };
}

function fakes(rows: CustomVoice[] = [], account = { used: 0, limit: 30 }) {
  const store: VoiceStore = {
    list: vi.fn(async (orgId) => rows.filter((r) => r.orgId === orgId)),
    insert: vi.fn(async (row) => voice({ id: 'new', orgId: row.orgId, providerVoiceId: row.providerVoiceId, name: row.name, method: row.method })),
    remove: vi.fn(async () => undefined),
    ownedElsewhere: vi.fn(async (orgId, voiceId) => rows.some((r) => r.providerVoiceId === voiceId && r.orgId !== orgId)),
    unpurgedClones: vi.fn(async () => rows.filter((r) => r.method === 'instant_clone')),
    markSamplesPurged: vi.fn(async () => undefined),
    allProviderIds: vi.fn(async () => new Set(rows.map((r) => r.providerVoiceId)))
  };
  const provider: VoiceProvider = {
    library: vi.fn(),
    design: vi.fn(async () => [{ generatedVoiceId: 'g1', audioBase64: 'QQ==', mime: 'audio/mpeg' }]),
    saveDesign: vi.fn(async () => 'el-new'),
    clone: vi.fn(async () => 'el-clone'),
    sampleIds: vi.fn(async () => ['s1']),
    deleteSample: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    labelled: vi.fn(async () => []),
    slots: vi.fn(async () => account)
  };
  const bill = vi.fn();
  const deps: VoiceDeps = { store, provider, bill, plan: null };
  return { store, provider, bill, deps };
}

const CLONE = { name: 'Me', samples: [SAMPLE], seconds: CLONE_MIN_SECONDS, consentBasis: 'own_voice' as const, speaker: '', attested: true, mode: ProjectMode.Standard };

describe('custom voice slots', () => {
  it('count what the org made against its plan and the account', async () => {
    const { deps } = fakes([voice()]);
    expect(await voiceSlots(deps, 'org-1')).toEqual({ used: 1, quota: VOICE_SLOTS_BY_PLAN.none, left: VOICE_SLOTS_BY_PLAN.none - 1 });
  });
});

describe('voice design', () => {
  it('bills the previews and returns them', async () => {
    const { deps, bill } = fakes();
    expect(await designPreviews(deps, SCOPE, { description: 'warm narrator' })).toEqual({ ok: true, previews: [{ generatedVoiceId: 'g1', audioBase64: 'QQ==', mime: 'audio/mpeg' }] });
    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ method: 'design', costUsd: VOICE_CREATION_USD.design, ok: true }));
  });

  it('refuses when the slots are full, before spending', async () => {
    const { deps, provider } = fakes([], { used: 30, limit: 30 });
    expect(await designPreviews(deps, SCOPE, { description: 'x' })).toEqual({ ok: false, error: 'voice_slots_full' });
    expect(provider.design).not.toHaveBeenCalled();
  });

  it('saves a preview tagged with the org, and records it', async () => {
    const { deps, provider, store } = fakes();
    const out = await saveDesignedVoice(deps, SCOPE, { generatedVoiceId: 'g1', name: 'Narrator', description: 'warm' });
    expect(out.ok).toBe(true);
    expect(provider.saveDesign).toHaveBeenCalledWith(expect.objectContaining({ labels: { [VOICE_ORG_LABEL]: 'org-1' } }));
    expect(store.insert).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', providerVoiceId: 'el-new', method: 'design' }));
  });
});

describe('instant cloning', () => {
  it('creates the voice with consent recorded, bills it, and deletes the samples at the provider', async () => {
    const { deps, provider, store, bill } = fakes();
    const out = await cloneVoice(deps, SCOPE, CLONE);
    expect(out.ok).toBe(true);
    expect(store.insert).toHaveBeenCalledWith(expect.objectContaining({ method: 'instant_clone', consentBasis: 'own_voice', consentAttestedAt: expect.any(String) }));
    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ method: 'instant_clone', costUsd: VOICE_CREATION_USD.instant_clone }));
    expect(provider.deleteSample).toHaveBeenCalledWith('el-clone', 's1');
    expect(store.markSamplesPurged).toHaveBeenCalledWith('new');
  });

  it('refuses without consent and never calls the provider', async () => {
    const { deps, provider } = fakes();
    expect(await cloneVoice(deps, SCOPE, { ...CLONE, attested: false })).toEqual({ ok: false, error: 'consent_required' });
    expect(provider.clone).not.toHaveBeenCalled();
  });

  it('refuses in an uncensored project', async () => {
    const { deps, provider } = fakes();
    expect(await cloneVoice(deps, SCOPE, { ...CLONE, mode: ProjectMode.Uncensored })).toEqual({ ok: false, error: 'cloning_not_in_this_project' });
    expect(provider.clone).not.toHaveBeenCalled();
  });

  it('removes the provider voice when the row cannot be written', async () => {
    const { deps, provider, store } = fakes();
    vi.mocked(store.insert).mockRejectedValueOnce(new Error('db down'));
    await expect(cloneVoice(deps, SCOPE, CLONE)).rejects.toThrow('db down');
    expect(provider.remove).toHaveBeenCalledWith('el-clone');
  });

  it('keeps the voice when sample deletion fails, leaving it for the sweep', async () => {
    const { deps, provider, store } = fakes();
    vi.mocked(provider.deleteSample).mockRejectedValueOnce(new Error('503'));
    expect((await cloneVoice(deps, SCOPE, CLONE)).ok).toBe(true);
    expect(store.markSamplesPurged).not.toHaveBeenCalled();
  });
});

describe('deleting a voice', () => {
  it('deletes it at the provider first, then the row', async () => {
    const { deps, provider, store } = fakes([voice()]);
    expect(await deleteVoice(deps, 'org-1', 'row-1')).toEqual({ ok: true });
    expect(provider.remove).toHaveBeenCalledWith('el-1');
    expect(store.remove).toHaveBeenCalledWith('org-1', 'row-1');
  });

  it('refuses a voice of another org', async () => {
    const { deps, provider } = fakes([voice({ orgId: 'org-2' })]);
    expect(await deleteVoice(deps, 'org-1', 'row-1')).toEqual({ ok: false, error: 'voice_not_found' });
    expect(provider.remove).not.toHaveBeenCalled();
  });
});

describe('the sweeps', () => {
  it('delete leftover clone samples and mark them', async () => {
    const { deps, store, provider } = fakes([voice({ method: 'instant_clone' })]);
    expect(await purgeVoiceSamples(deps)).toEqual({ purged: 1, failed: 0 });
    expect(provider.deleteSample).toHaveBeenCalledWith('el-1', 's1');
    expect(store.markSamplesPurged).toHaveBeenCalledWith('row-1');
  });

  it('delete provider voices whose org or row is gone, and only ours', async () => {
    const { deps, provider } = fakes([voice()]);
    vi.mocked(provider.labelled).mockResolvedValueOnce([
      { voiceId: 'el-1', value: 'org-1' },
      { voiceId: 'el-orphan', value: 'org-deleted' }
    ]);
    expect(await sweepOrphanVoices(deps)).toEqual({ removed: 1 });
    expect(provider.labelled).toHaveBeenCalledWith(VOICE_ORG_LABEL);
    expect(provider.remove).toHaveBeenCalledTimes(1);
    expect(provider.remove).toHaveBeenCalledWith('el-orphan');
  });
});

describe('using a voice', () => {
  it('refuses a custom voice of another org', async () => {
    const { store } = fakes([voice({ orgId: 'org-2' })]);
    expect(await voiceRefusalFor(store, { orgId: 'org-1', voiceId: 'el-1', mode: ProjectMode.Standard })).toBe('voice_not_yours');
  });

  it('refuses an own clone in an uncensored project, allows a designed one', async () => {
    const { store } = fakes([voice({ method: 'instant_clone' }), voice({ id: 'r2', providerVoiceId: 'el-2' })]);
    expect(await voiceRefusalFor(store, { orgId: 'org-1', voiceId: 'el-1', mode: ProjectMode.Uncensored })).toBe('cloned_voice_not_in_this_project');
    expect(await voiceRefusalFor(store, { orgId: 'org-1', voiceId: 'el-2', mode: ProjectMode.Uncensored })).toBeNull();
    expect(await voiceRefusalFor(store, { orgId: 'org-1', voiceId: 'premade', mode: ProjectMode.Standard })).toBeNull();
  });
});

describe('the voice sweep on the tick', () => {
  it('purges samples every tick and looks for orphans only on the hour', async () => {
    const { deps, provider } = fakes([voice({ method: 'instant_clone' })]);
    expect(await sweepVoices(deps, new Date('2026-10-06T10:07:00Z'))).toEqual({ samples: { purged: 1, failed: 0 }, orphans: { removed: 0 } });
    expect(provider.labelled).not.toHaveBeenCalled();
    await sweepVoices(deps, new Date('2026-10-06T11:00:00Z'));
    expect(provider.labelled).toHaveBeenCalledTimes(1);
  });
});
