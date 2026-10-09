import { json } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { insertAsset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { findNode } from '$lib/server/repos/canvas';
import { agentActor } from '$lib/server/repos/actor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { motionOf } from '$lib/canvas/motion-node';
import { AssetKind } from '$lib/motion/components';
import { renderScore } from '$lib/motion/sound/render';
import { soundScoreSchema, type SoundScore } from '$lib/motion/sound/score';
import { WAV_MIME, encodeWav } from '$lib/motion/sound/wav';
import { laySound } from '$lib/motion/sound/lay';
import { headOrNew, saveMotionDoc } from './editor';
import type { SoundStored } from './motion-tools';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const API_AGENT_KEY = 'mcp';
const SOUND_LABEL = 'sound design';

type StoreScope = { orgId: string; projectId: string; nodeId: string };

export async function storeSound(db: Db, scope: StoreScope, score: SoundScore, seconds: number): Promise<SoundStored> {
  const bytes = encodeWav(renderScore(score, seconds));
  const path = `${scope.orgId}/${scope.projectId}/sound/${crypto.randomUUID()}.wav`;
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, new Blob([bytes as BlobPart], { type: WAV_MIME }), { contentType: WAV_MIME, upsert: false });
  if (error) {
    return { ok: false, error: `store_failed: ${error.message}` };
  }
  const asset = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'audio', source: 'upload', url: path, mimeType: WAV_MIME, bytes: bytes.byteLength, durationS: seconds, sourceNodeId: scope.nodeId });
  const signed = await signAssetPaths(db, createAssetSigningDb(), { generated: [], uploaded: [path] });
  return { ok: true, assetId: asset.id, seconds, url: signed.get(path) ?? null };
}

const bad = (error: string, status = HTTP_BAD_REQUEST) => json({ error }, { status });

export async function writeSound(db: Db, scope: { orgId: string; userId: string; nodeId: string }, body: unknown): Promise<Record<string, unknown> | Response> {
  const record = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  const node = record ? motionOf(record) : null;
  if (!record || !node) {
    return bad('motion_node_not_found', HTTP_NOT_FOUND);
  }
  const score = soundScoreSchema.safeParse(body);
  if (!score.success) {
    return bad(score.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }

  const head = await headOrNew(db, { orgId: scope.orgId, nodeId: scope.nodeId }, node);
  const stored = await storeSound(db, { orgId: scope.orgId, projectId: record.projectId, nodeId: scope.nodeId }, score.data, head.doc.durationInFrames / head.doc.fps);
  if (!stored.ok) {
    return bad(stored.error);
  }
  const short = () => crypto.randomUUID().slice(0, 8);
  const laid = laySound(head.doc, { score: score.data, assetId: stored.assetId }, { clip: short(), track: short() });
  if (!laid.ok) {
    return bad(laid.error);
  }
  const assets = laid.doc.assets.some((a) => a.id === stored.assetId) ? laid.doc.assets : [...laid.doc.assets, { id: stored.assetId, kind: AssetKind.Audio, name: SOUND_LABEL }];
  const write = await saveMotionDoc(db, { orgId: scope.orgId, nodeId: scope.nodeId, expectedVersion: head.version, doc: { ...laid.doc, assets }, actor: agentActor(scope.userId, API_AGENT_KEY), summary: 'Sound design' });
  if (write.outcome !== RevisionOutcome.Written) {
    return bad('conflict', HTTP_CONFLICT);
  }
  return { ok: true, version: write.head.version, asset_id: stored.assetId, clip_id: laid.doc.sound?.clipId, events: score.data.events.length };
}
