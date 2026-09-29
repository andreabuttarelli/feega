import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { listConnections, listNodesByIds, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findAssets } from '$lib/server/repos/assets';
import { uploadedNodeOf } from '$lib/canvas/uploaded-node';
import { referencesOf, type ReferenceSource } from '$lib/canvas/node-references';

export enum Provenance {
  CatalogueFace = 'catalogue_face',
  UploadedFace = 'uploaded_face',
  UnmarkedPersona = 'unmarked_persona',
  MinorPersona = 'minor_persona',
  AdultPersona = 'adult_persona',
  UploadedMedia = 'uploaded_media',
  ReferencePhoto = 'reference_photo',
  GeneratedMedia = 'generated_media'
}

const ADULT_AGE = 18;

export const UNCENSORED_REFERENCE_RULES: Readonly<Record<Provenance, { allowed: boolean; refusal: string }>> = {
  [Provenance.CatalogueFace]: { allowed: false, refusal: 'Refused: catalogue influencers are real people and cannot appear in uncensored generations.' },
  [Provenance.UploadedFace]: { allowed: false, refusal: 'Refused: an influencer built from uploaded photos may be a real person.' },
  [Provenance.UnmarkedPersona]: { allowed: false, refusal: 'Refused: mark this AI influencer as a consenting adult persona in Settings first.' },
  [Provenance.MinorPersona]: { allowed: false, refusal: 'Refused: this influencer is not declared 18 or older.' },
  [Provenance.AdultPersona]: { allowed: true, refusal: '' },
  [Provenance.UploadedMedia]: { allowed: false, refusal: 'Refused: uploaded images may show real people; uncensored models accept only generated references.' },
  [Provenance.ReferencePhoto]: { allowed: false, refusal: 'Refused: reference photos may show real people; uncensored models accept only generated references.' },
  [Provenance.GeneratedMedia]: { allowed: true, refusal: '' }
};

export type ProvenanceEntry = { kind: Provenance; label: string };

type InfluencerFacts = { orgId: string | null; source: string; age: number | null; adultPersonaAt: string | null };

const INFLUENCER_SOURCE_KIND: Readonly<Record<string, Provenance>> = {
  catalogue: Provenance.CatalogueFace,
  upload: Provenance.UploadedFace
};

const ASSET_SOURCE_KIND: Readonly<Record<string, Provenance>> = {
  generated: Provenance.GeneratedMedia
};

const REFERENCE_SOURCE_KIND: Readonly<Record<ReferenceSource, Provenance | null>> = {
  catalogue: Provenance.ReferencePhoto,
  asset: null
};

export function classifyInfluencer(influencer: InfluencerFacts): Provenance {
  if (influencer.orgId === null) {
    return Provenance.CatalogueFace;
  }
  const bySource = INFLUENCER_SOURCE_KIND[influencer.source];
  if (bySource) {
    return bySource;
  }
  if (influencer.age === null || influencer.age < ADULT_AGE) {
    return Provenance.MinorPersona;
  }
  return influencer.adultPersonaAt ? Provenance.AdultPersona : Provenance.UnmarkedPersona;
}

export function likenessRefusal(entries: ProvenanceEntry[]): string | null {
  const refused = entries.find((entry) => !UNCENSORED_REFERENCE_RULES[entry.kind].allowed);
  return refused ? UNCENSORED_REFERENCE_RULES[refused.kind].refusal : null;
}

function assetKind(source: string | null | undefined): Provenance {
  return ASSET_SOURCE_KIND[source ?? ''] ?? Provenance.UploadedMedia;
}

async function influencerEntries(db: Db, ids: string[]): Promise<ProvenanceEntry[]> {
  if (!ids.length) {
    return [];
  }
  const { data } = await (db as unknown as SupabaseClient)
    .from('influencers')
    .select('id, org_id, source, age, adult_persona_at, name')
    .in('id', ids);
  const rows = (data ?? []) as Array<{ org_id: string | null; source: string; age: number | null; adult_persona_at: string | null; name: string }>;
  const found = rows.map((row) => ({
    kind: classifyInfluencer({ orgId: row.org_id, source: row.source, age: row.age, adultPersonaAt: row.adult_persona_at }),
    label: `influencer ${row.name}`
  }));
  const missing = ids.length - rows.length;
  return [...found, ...Array.from({ length: missing }, () => ({ kind: Provenance.CatalogueFace, label: 'unknown influencer' }))];
}

function mediaAssetId(node: CanvasNodeRecord): string | null {
  const uploaded = uploadedNodeOf({ id: node.id, data: node.data });
  if (uploaded) {
    return uploaded.assetId;
  }
  return typeof node.data.refId === 'string' ? node.data.refId : null;
}

export async function upstreamProvenance(
  db: Db,
  input: { orgId: string; canvasId: string; nodeId: string; data: Record<string, unknown> }
): Promise<ProvenanceEntry[]> {
  const connections = (await listConnections(db, { orgId: input.orgId, canvasId: input.canvasId })).filter(
    (c) => c.targetNodeId === input.nodeId
  );
  const sources = await listNodesByIds(db, { orgId: input.orgId, nodeIds: connections.map((c) => c.sourceNodeId) });

  const influencerIds = sources
    .filter((n) => n.type === 'influencer' && typeof n.data.influencer_id === 'string')
    .map((n) => n.data.influencer_id as string);
  const references = referencesOf(input.data);
  const assetIds = [
    ...sources.filter((n) => n.type !== 'influencer').map(mediaAssetId),
    ...references.filter((r) => r.source === 'asset').map((r) => r.id)
  ].filter((id): id is string => Boolean(id));

  const [influencers, assets] = await Promise.all([
    influencerEntries(db, influencerIds),
    findAssets(db, { orgId: input.orgId, assetIds })
  ]);

  const media = assetIds.map((id) => ({ kind: assetKind(assets.get(id)?.source), label: `${assets.get(id)?.source ?? 'unknown'} media` }));
  const photos = references
    .map((r) => REFERENCE_SOURCE_KIND[r.source])
    .filter((kind): kind is Provenance => kind !== null)
    .map((kind) => ({ kind, label: 'reference photo' }));

  return [...influencers, ...media, ...photos];
}
