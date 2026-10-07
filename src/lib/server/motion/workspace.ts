import type { Tool } from 'ai';
import type { Db } from '$lib/server/db/client';
import type { BrandTokens } from '$lib/motion/brand';
import type { MotionHead } from '$lib/server/repos/motion-revisions';
import { assetUrls, motionAssets, type MotionAsset } from '$lib/server/motion/editor';
import { withOrgContext } from '$lib/server/ai-log';
import { createMotionTools, type MotionSession, type MotionToolDeps } from '$lib/server/motion/motion-tools';
import { templateLibrary } from '$lib/server/motion/templates';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { generateSound, Sound, speakVoiceover } from '$lib/server/motion/voiceover';
import { musicOrBed, storeBed } from '$lib/server/motion/music-source';
import { brandSources } from '$lib/server/motion/brand-sources';
import { frameStats } from '$lib/server/motion/frame-stats';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { rowRequests } from '$lib/server/motion/batch-input';
import { startBatch } from '$lib/server/motion/render-run';
import { motionRenderFarm, motionRenderStorage } from '$lib/server/motion/renderer';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import type { Actor } from '$lib/server/repos/actor';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';

export type WorkspaceScope = {
  db: Db;
  userId: string;
  orgId: string;
  project: { id: string; brandId: string | null };
  record: CanvasNodeRecord;
  actor: Actor;
  agentKey: string;
};

export type WorkspaceInput = {
  head: MotionHead;
  tokens: BrandTokens;
  assets: MotionAsset[];
  session: MotionSession;
  frames: MotionToolDeps['frames'];
  check: MotionToolDeps['check'];
};

export function workspaceTools(scope: WorkspaceScope, input: WorkspaceInput): Record<string, Tool> {
  const { db, userId, orgId, project, record, actor, agentKey } = scope;
  const { head, tokens, assets, session } = input;
  const nodeScope = { orgId, nodeId: record.id };

  return createMotionTools({
    session,
    assets,
    newId: () => crypto.randomUUID().slice(0, 8),
    templates: templateLibrary(db, { orgId, actor: { kind: 'agent', id: userId, agentKey } }),
    ...brandSources(db, { orgId, projectId: project.id, canvasId: record.canvasId, brandId: project.brandId }),
    analysis: async (assetId) => (await analyzeSounds(storageAnalysis(db), { orgId, projectId: project.id }, assets, [assetId]))[assetId] ?? null,
    voiceover: (voice) => withOrgContext(orgId, () => speakVoiceover(db, { orgId, projectId: project.id, nodeId: record.id, userId, actor }, voice)),
    music: (input) => musicOrBed({ generate: () => withOrgContext(orgId, () => generateSound(db, { orgId, projectId: project.id, nodeId: record.id, userId, actor }, Sound.Music, input)), store: (wav, spec) => storeBed(db, { orgId, projectId: project.id }, wav, spec) }, input),
    frames: input.frames,
    inspect: frameStats,
    check: input.check,
    batch: async ({ rows }) => {
      if (session.edits.length) {
        return { ok: false, error: 'this turn has unsaved edits: the batch renders the saved video, so finish the turn and run render_batch in the next one' };
      }
      const renderAssets = await motionAssets({ db, orgId, projectId: project.id, canvasId: record.canvasId, nodeId: record.id }, SIGNED_URL_TTL_S.render);
      const made = rowRequests(head, rows, { tokens, assets: assetUrls(renderAssets) }, settingsOf(Preset.Social));
      if (!made.ok) {
        return made;
      }
      const editorUrl = `/p/${project.id}/c/${record.canvasId}/motion/${record.id}`;
      return startBatch(db, motionRenderFarm(), { ...nodeScope, projectId: project.id, userId, editorUrl }, made.rows, motionRenderStorage());
    }
  });
}
