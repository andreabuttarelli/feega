import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { assetUrls, findMotionNode, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { motionRenderFarm, motionRenderStorage } from '$lib/server/motion/renderer';
import { batchView, cancelRender, renderRequest, renderView, startBatch, startRender } from '$lib/server/motion/render-run';
import { batchInput, rowRequests } from '$lib/server/motion/batch-input';
import { parseSettings } from '$lib/motion/export-formats';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { saveExport } from '$lib/server/motion/export';
import { Sound, generateSound } from '$lib/server/motion/voiceover';
import { withOrgContext } from '$lib/server/ai-log';
import { saveFontUpload } from '$lib/server/motion/font-upload';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { clipsOf, parseMotionDoc } from '$lib/motion/doc';
import { templateLibrary } from '$lib/server/motion/templates';
import type { Db } from '$lib/server/db/client';

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const HTTP_CONFLICT = 409;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAVAILABLE = 503;

async function scopeFor(locals: App.Locals, params: { projectId: string; canvasId: string; nodeId: string }) {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }
  const db = await locals.db();
  if (!db) {
    throw error(500, 'no client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }

  const motion = await findMotionNode(db, { orgId: found.orgId, nodeId: params.nodeId, place: { canvasId: found.canvas.id } });
  if (!motion) {
    throw error(404, 'This motion node does not exist');
  }
  return { db, userId: user.id, orgId: found.orgId, canvas: found.canvas, projectBrandId: found.projectBrandId, motion };
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const scope = await scopeFor(locals, params);
  const nodeScope = { orgId: scope.orgId, nodeId: scope.motion.record.id };
  const farm = motionRenderFarm();
  const [head, tokens, assets, runs, uploadLimit, templates] = await Promise.all([
    headOrNew(scope.db, nodeScope, scope.motion.node),
    motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId }),
    motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id }),
    listNodeRuns(scope.db, nodeScope),
    farm ? motionRenderStorage().limit().catch(() => null) : null,
    libraryOf(scope).list()
  ]);

  return {
    projectId: params.projectId,
    canvas: { id: scope.canvas.id, name: scope.canvas.name },
    orgId: scope.orgId,
    node: { id: scope.motion.record.id, name: scope.motion.record.displayName, lastRenderAssetId: scope.motion.node.lastRenderAssetId },
    head: { version: head.version, doc: head.doc },
    tokens,
    assets,
    serverRender: { configured: farm !== null, latest: renderView(runs), uploadLimit },
    batch: batchView(runs),
    templates
  };
};

const libraryOf = (scope: { db: Db; orgId: string; userId: string }) => templateLibrary(scope.db, { orgId: scope.orgId, actor: { kind: 'user', id: scope.userId } });

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const version = Number(form.get('version'));
    const summary = String(form.get('summary') ?? '') || null;
    let doc: unknown;
    try {
      doc = JSON.parse(String(form.get('doc') ?? ''));
    } catch {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid_doc' });
    }

    const write = await saveMotionDoc(scope.db, {
      orgId: scope.orgId,
      nodeId: scope.motion.record.id,
      expectedVersion: Number.isInteger(version) ? version : -1,
      doc,
      actor: { kind: 'user', id: scope.userId },
      summary
    });

    if (write.outcome === RevisionOutcome.Conflict) {
      const head = await headOrNew(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id }, scope.motion.node);
      return fail(HTTP_CONFLICT, { error: 'conflict', head: { version: head.version, doc: head.doc } });
    }
    if (write.outcome === RevisionOutcome.Invalid) {
      return fail(HTTP_BAD_REQUEST, { error: write.error });
    }
    return { version: write.head.version };
  },

  exported: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const saved = await saveExport(scope.db, {
      orgId: scope.orgId,
      projectId: params.projectId,
      nodeId: scope.motion.record.id,
      actor: { kind: 'user', id: scope.userId },
      path: String(form.get('path') ?? ''),
      width: Number(form.get('width')),
      height: Number(form.get('height')),
      seconds: Number(form.get('seconds'))
    });
    return saved.ok ? { assetId: saved.assetId } : fail(HTTP_BAD_REQUEST, { error: saved.error });
  },

  uploadFont: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const saved = await saveFontUpload(scope.db, { orgId: scope.orgId, projectId: params.projectId, path: String(form.get('path') ?? '') });
    if (!saved.ok) {
      return fail(HTTP_BAD_REQUEST, { error: saved.error });
    }
    const assets = await motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id });
    return { asset: assets.find((a) => a.id === saved.assetId) ?? null };
  },

  analyze: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const ids = form.getAll('assetId').map(String);
    const assets = await motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id });
    return { analyses: await analyzeSounds(storageAnalysis(scope.db), { orgId: scope.orgId, projectId: params.projectId }, assets, ids) };
  },

  sound: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const sound = String(form.get('sound')) as Sound;
    const text = String(form.get('text') ?? '').trim();
    if (!Object.values(Sound).includes(sound) || !text) {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid_sound' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const soundScope = { orgId: scope.orgId, projectId: params.projectId, nodeId: scope.motion.record.id, userId: scope.userId, actor: { kind: 'user' as const, id: scope.userId } };
    const made = await withOrgContext(scope.orgId, () => generateSound(scope.db, soundScope, sound, { text, seconds: Number(form.get('seconds')) || undefined }));
    return made.ok ? { assetId: made.assetId, seconds: made.seconds, url: made.url } : fail(HTTP_UNAVAILABLE, { error: made.error });
  },

  render: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const version = Number(form.get('version'));
    const settings = parseSettings(form.get('settings') as string | null);
    if (!settings.ok) {
      return fail(HTTP_BAD_REQUEST, { error: settings.error });
    }
    const nodeScope = { orgId: scope.orgId, nodeId: scope.motion.record.id };
    const head = await headOrNew(scope.db, nodeScope, scope.motion.node);
    if (head.version !== version) {
      return fail(HTTP_CONFLICT, { error: 'save_first' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const [assets, tokens] = await Promise.all([
      motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id }, SIGNED_URL_TTL_S.render),
      motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId })
    ]);
    const soundIds = clipsOf(head.doc).map((c) => String(c.props.assetId ?? ''));
    const analyses = await analyzeSounds(storageAnalysis(scope.db), { orgId: scope.orgId, projectId: params.projectId }, assets, soundIds);
    const req = renderRequest(version, { doc: head.doc, tokens, assets: assetUrls(assets), analyses }, settings.settings);

    const editorUrl = `/p/${params.projectId}/c/${params.canvasId}/motion/${params.nodeId}`;
    const renderScope = { ...nodeScope, projectId: params.projectId, userId: scope.userId, editorUrl };
    const started = await startRender(scope.db, motionRenderFarm(), renderScope, req, motionRenderStorage());
    return started.ok ? { runId: started.runId, quote: started.quote } : fail(HTTP_UNAVAILABLE, { error: started.error, detail: started.detail });
  },

  renderBatch: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const settings = parseSettings(form.get('settings') as string | null);
    const input = batchInput(form.get('rows') as string | null);
    if (!settings.ok) {
      return fail(HTTP_BAD_REQUEST, { error: settings.error });
    }
    if (!input.ok) {
      return fail(HTTP_BAD_REQUEST, { error: input.error });
    }
    const nodeScope = { orgId: scope.orgId, nodeId: scope.motion.record.id };
    const head = await headOrNew(scope.db, nodeScope, scope.motion.node);
    if (head.version !== Number(form.get('version'))) {
      return fail(HTTP_CONFLICT, { error: 'save_first' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const [assets, tokens] = await Promise.all([
      motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id }, SIGNED_URL_TTL_S.render),
      motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId })
    ]);
    const rows = rowRequests(head, input.rows, { tokens, assets: assetUrls(assets) }, settings.settings);
    if (!rows.ok) {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid_row', detail: rows.error });
    }

    const editorUrl = `/p/${params.projectId}/c/${params.canvasId}/motion/${params.nodeId}`;
    const renderScope = { ...nodeScope, projectId: params.projectId, userId: scope.userId, editorUrl };
    const started = await startBatch(scope.db, motionRenderFarm(), renderScope, rows.rows, motionRenderStorage());
    return started.ok ? started : fail(HTTP_UNAVAILABLE, { error: started.error, detail: started.detail });
  },

  saveTemplate: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const parsed = parseMotionDoc(parsedJson(String(form.get('doc') ?? '')));
    if (!parsed.ok) {
      return fail(HTTP_BAD_REQUEST, { error: parsed.error });
    }
    const saved = await libraryOf(scope).save({
      doc: parsed.doc,
      compId: String(form.get('compId') ?? '') || null,
      meta: { name: String(form.get('name') ?? ''), description: String(form.get('description') ?? '') },
      posterFrame: Number(form.get('posterFrame')) || 0
    });
    return saved.ok ? { entry: saved.entry } : fail(HTTP_BAD_REQUEST, { error: saved.error });
  },

  deleteTemplate: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const form = await request.formData();
    const removed = await libraryOf(scope).remove(String(form.get('id') ?? ''));
    return removed ? { removed: true } : fail(HTTP_BAD_REQUEST, { error: 'not_removable' });
  },

  batchStatus: async ({ locals, params }) => {
    const scope = await scopeFor(locals, params);
    const runs = await listNodeRuns(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id });
    return { batch: batchView(runs) };
  },

  cancelRender: async ({ locals, params }) => {
    const scope = await scopeFor(locals, params);
    const farm = motionRenderFarm();
    if (!farm) {
      return fail(HTTP_UNAVAILABLE, { error: 'rendering_not_configured' });
    }
    const cancelled = await cancelRender(scope.db, farm, { orgId: scope.orgId, nodeId: scope.motion.record.id });
    return cancelled.ok ? { cancelled: true } : fail(HTTP_CONFLICT, { error: 'nothing_to_cancel' });
  },

  renderStatus: async ({ locals, params }) => {
    const scope = await scopeFor(locals, params);
    const runs = await listNodeRuns(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id });
    return { render: renderView(runs) };
  }
};
