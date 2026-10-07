import { describe, expect, it, vi } from 'vitest';
import { supabaseVoiceStore } from './voice-store';

function chain(result: unknown) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'insert', 'delete', 'update', 'eq', 'is', 'order', 'single']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    });
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  builder.rpc = vi.fn(async (...args: unknown[]) => {
    calls.push(['rpc', args]);
    return result;
  });
  return { db: builder as never, calls };
}

const ROW = { id: 'r1', org_id: 'o1', provider_voice_id: 'el', name: 'N', method: 'design', preview_url: null, created_at: 't' };

describe('the custom voice store', () => {
  it('lists an org voices, newest first', async () => {
    const { db, calls } = chain({ data: [ROW], error: null });
    expect(await supabaseVoiceStore(db).list('o1')).toEqual([
      { id: 'r1', orgId: 'o1', providerVoiceId: 'el', name: 'N', method: 'design', previewUrl: null, createdAt: 't' }
    ]);
    expect(calls).toContainEqual(['from', ['custom_voices']]);
    expect(calls).toContainEqual(['eq', ['org_id', 'o1']]);
  });

  it('writes consent and actor columns on insert', async () => {
    const { db, calls } = chain({ data: ROW, error: null });
    await supabaseVoiceStore(db).insert({
      orgId: 'o1',
      providerVoiceId: 'el',
      name: 'N',
      method: 'instant_clone',
      description: null,
      consentBasis: 'own_voice',
      consentSpeaker: null,
      consentAttestedAt: 'when',
      actor: { kind: 'user', id: 'u1' }
    });
    const insert = calls.find(([m]) => m === 'insert')![1][0];
    expect(insert).toMatchObject({ org_id: 'o1', consent_basis: 'own_voice', consent_attested_at: 'when', actor_kind: 'user', actor_id: 'u1' });
  });

  it('asks the database whether another org owns a voice id', async () => {
    const { db, calls } = chain({ data: true, error: null });
    expect(await supabaseVoiceStore(db).ownedElsewhere('o1', 'el')).toBe(true);
    expect(calls).toContainEqual(['rpc', ['voice_owned_elsewhere', { p_voice: 'el', p_org: 'o1' }]]);
  });

  it('fails loudly on a database error', async () => {
    const { db } = chain({ data: null, error: { message: 'boom' } });
    await expect(supabaseVoiceStore(db).list('o1')).rejects.toThrow('boom');
  });
});
