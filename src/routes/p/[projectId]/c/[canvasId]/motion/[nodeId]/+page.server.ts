import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { assetUrls, findMotionNode, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { motionRenderer, RENDER_NOT_CONFIGURED } from '$lib/server/motion/renderer';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { parseMotionDoc } from '$lib/motion/doc';
import { renderQuote } from '$lib/motion/render-quote';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { saveExport } from '$lib/server/motion/export';
import { Sound, generateSound } from '$lib/server/motion/voiceover';
import { withOrgContext } from '$lib/server/ai-log';

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
  const [head, tokens, assets] = await Promise.all([
    headOrNew(scope.db, nodeScope, scope.motion.node),
    motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId }),
    motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id })
  ]);

  return {
    projectId: params.projectId,
    canvas: { id: scope.canvas.id, name: scope.canvas.name },
    orgId: scope.orgId,
    node: { id: scope.motion.record.id, name: scope.motion.record.displayName, lastRenderAssetId: scope.motion.node.lastRenderAssetId },
    head: { version: head.version, doc: head.doc },
    tokens,
    assets,
    renderConfigured: motionRenderer().configured
  };
};

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
    const parsed = parseMotionDoc(JSON.parse(String((await request.formData()).get('doc') ?? 'null')));
    if (!parsed.ok) {
      return fail(HTTP_BAD_REQUEST, { error: parsed.error });
    }

    const renderer = motionRenderer();
    if (!renderer.configured) {
      return fail(HTTP_UNAVAILABLE, { error: RENDER_NOT_CONFIGURED });
    }

    const quote = renderQuote(parsed.doc);
    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const assets = await motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id });
    const tokens = await motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId });
    const html = composeHtml({ doc: parsed.doc, tokens, assets: assetUrls(assets) });
    const started = await renderer.start({ html, width: parsed.doc.width, height: parsed.doc.height, fps: parsed.doc.fps, durationInFrames: parsed.doc.durationInFrames });
    return started.ok ? { renderId: started.renderId, quote } : fail(HTTP_UNAVAILABLE, { error: started.error });
  }
};
