import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { actorCols } from '$lib/server/repos/actor';
import type { VoiceMethod } from '$lib/canvas/voices';
import type { CustomVoice, NewVoice, VoiceStore } from './custom-voices';

const TABLE = 'custom_voices';
const COLUMNS = 'id, org_id, provider_voice_id, name, method, preview_url, created_at';

type Row = { id: string; org_id: string; provider_voice_id: string; name: string; method: VoiceMethod; preview_url: string | null; created_at: string };

function voiceOf(row: Row): CustomVoice {
  return {
    id: row.id,
    orgId: row.org_id,
    providerVoiceId: row.provider_voice_id,
    name: row.name,
    method: row.method,
    previewUrl: row.preview_url,
    createdAt: row.created_at
  };
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(`custom_voices: ${result.error.message}`);
  }
  return result.data as T;
}

export function supabaseVoiceStore(db: Db): VoiceStore {
  const client = db as unknown as SupabaseClient;
  const table = () => client.from(TABLE);

  return {
    async list(orgId) {
      const rows = unwrap<Row[]>(await table().select(COLUMNS).eq('org_id', orgId).order('created_at', { ascending: false }));
      return (rows ?? []).map(voiceOf);
    },

    async insert(row: NewVoice) {
      const inserted = unwrap<Row>(
        await table()
          .insert({
            org_id: row.orgId,
            provider_voice_id: row.providerVoiceId,
            name: row.name,
            method: row.method,
            description: row.description,
            consent_basis: row.consentBasis,
            consent_speaker: row.consentSpeaker,
            consent_attested_at: row.consentAttestedAt,
            ...actorCols(row.actor)
          })
          .select(COLUMNS)
          .single()
      );
      return voiceOf(inserted);
    },

    async remove(orgId, id) {
      unwrap(await table().delete().eq('org_id', orgId).eq('id', id));
    },

    async ownedElsewhere(orgId, providerVoiceId) {
      return Boolean(unwrap(await client.rpc('voice_owned_elsewhere', { p_voice: providerVoiceId, p_org: orgId })));
    },

    async unpurgedClones() {
      const rows = unwrap<Row[]>(await table().select(COLUMNS).eq('method', 'instant_clone').is('samples_purged_at', null));
      return (rows ?? []).map(voiceOf);
    },

    async markSamplesPurged(id) {
      unwrap(await table().update({ samples_purged_at: new Date().toISOString() }).eq('id', id));
    },

    async allProviderIds() {
      const rows = unwrap<{ provider_voice_id: string }[]>(await table().select('provider_voice_id'));
      return new Set((rows ?? []).map((r) => r.provider_voice_id));
    }
  };
}
