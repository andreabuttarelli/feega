import { z } from 'zod';
import type { Actor } from '$lib/server/repos/actor';
import { Checkpoint, RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { parseOps } from '$lib/motion/doc-ops';
import { OpsOutcome, commitOps } from '$lib/server/motion/frame-ops';
import { batchView, renderView } from '$lib/server/motion/render-run';
import type { MotionEditorScope } from '$lib/server/motion/editor-scope';
import { saveExport } from '$lib/server/motion/export';
import { deleteFontFamily, orgFontFamilies, renameFontFamily, saveFontUpload, type FontChange } from '$lib/server/motion/font-upload';
import { assetUrls, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { templateLibrary } from '$lib/server/motion/templates';
import { withTemplateSounds } from '$lib/server/motion/template-sounds';
import { laySfx } from '$lib/server/motion/sfx';
import { withOrgContext } from '$lib/server/ai-log';
import { parseMotionDoc } from '$lib/motion/doc';
import type { Sfx } from '$lib/motion/sfx';
import { Sound, generateSound } from '$lib/server/motion/voiceover';
import { rowRequests, rowsFrom } from '$lib/server/motion/batch-input';
import { startFarmBatch } from '$lib/server/motion/render-start';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { settingsFrom } from '$lib/motion/export-formats';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { editorSession } from '$lib/server/motion/editor-session';
import { nameVersion, namedRevisions } from '$lib/server/motion/version-names';
import { Restore, restoreRevision } from '$lib/server/motion/restore';
import { motionRenderFarm } from '$lib/server/motion/renderer';
import { cancelRender } from '$lib/server/motion/render-run';
import { startFarmRender } from '$lib/server/motion/render-start';
import { exportStill } from '$lib/server/motion/still-export';
import { stillAskSchema, stillExport } from '$lib/motion/still-model';
import { splitTags } from '$lib/gallery/model';
import { publishStatus } from '$lib/server/gallery/http';
import { withdrawFromGallery } from '$lib/server/gallery/publish';
import { publishNode } from '$lib/server/gallery/service';
import { BranchOutcome, type Refusal, createBranch, dropBranch, listBranches, mergeBranchBack, reviewBranch } from '$lib/server/motion/branches';
import { branchStore } from '$lib/server/motion/branch-store';
import { Side } from '$lib/motion/branch-merge';

export enum EditorAccess {
  Read = 'read',
  Write = 'write'
}

export type EditorAnswer = { status: number; body: Record<string, unknown> };

export type EditorCtx = MotionEditorScope & { actor: Actor; gate: () => Promise<EditorAnswer | null> };

type EditorOp<I extends z.ZodTypeAny> = { access: EditorAccess; input: I; run: (ctx: EditorCtx, input: z.infer<I>) => Promise<EditorAnswer> };

const op = <I extends z.ZodTypeAny>(def: EditorOp<I>) => def;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNAVAILABLE = 503;
const SFX_ID_LENGTH = 8;

const ok = (body: Record<string, unknown>): EditorAnswer => ({ status: HTTP_OK, body });
const refused = (status: number, body: Record<string, unknown>): EditorAnswer => ({ status, body });

const changed = (change: FontChange): EditorAnswer => (change.ok ? ok({ ok: true }) : refused(HTTP_BAD_REQUEST, { error: change.error }));

const nodeScope = (ctx: EditorCtx) => ({ orgId: ctx.orgId, nodeId: ctx.motion.record.id });

const summaryInput = z.string().nullable().optional();

const BRANCH_NAME_MAX = 120;

const branchesOf = (ctx: EditorCtx) => branchStore(ctx.db, { orgId: ctx.orgId, actor: ctx.actor });

const BRANCH_REFUSAL: Record<Refusal, () => EditorAnswer> = {
  [BranchOutcome.NotABranch]: () => refused(HTTP_BAD_REQUEST, { error: 'not_a_branch' }),
  [BranchOutcome.FrameGone]: () => refused(HTTP_NOT_FOUND, { error: 'frame_not_found' })
};

const placeOf = (ctx: EditorCtx) => ({ db: ctx.db, orgId: ctx.orgId, projectId: ctx.canvas.projectId, canvasId: ctx.canvas.id, nodeId: ctx.motion.record.id });

const userScope = (ctx: EditorCtx) => ({ db: ctx.db, orgId: ctx.orgId, userId: ctx.userId, actor: ctx.actor });

const soundScope = (ctx: EditorCtx) => ({ orgId: ctx.orgId, projectId: ctx.canvas.projectId, nodeId: ctx.motion.record.id, userId: ctx.userId, actor: ctx.actor });

export const EDITOR_OPS = {
  editor_session: op({
    access: EditorAccess.Read,
    input: z.object({ briefIds: z.array(z.string()).optional() }),
    run: async (ctx, input) => {
      const found = { orgId: ctx.orgId, canvas: ctx.canvas, mode: ctx.mode, projectBrandId: ctx.projectBrandId };
      return ok(await editorSession({ db: ctx.db, userId: ctx.userId, found }, { projectId: ctx.canvas.projectId, nodeId: ctx.motion.record.id, briefIds: input.briefIds ?? [] }));
    }
  }),

  read_head: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => {
      const head = await headOrNew(ctx.db, nodeScope(ctx), ctx.motion.node);
      return ok({ version: head.version, doc: head.doc, actorKind: head.actorKind });
    }
  }),

  save_doc: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number(), doc: z.unknown(), summary: summaryInput }),
    run: async (ctx, input) => {
      const write = await saveMotionDoc(ctx.db, {
        ...nodeScope(ctx),
        expectedVersion: Number.isInteger(input.version) ? input.version : -1,
        doc: input.doc,
        actor: ctx.actor,
        summary: input.summary || null,
        checkpoint: Checkpoint.Coalesce
      });
      if (write.outcome === RevisionOutcome.Conflict) {
        const head = await headOrNew(ctx.db, nodeScope(ctx), ctx.motion.node);
        return refused(HTTP_CONFLICT, { error: 'conflict', head: { version: head.version, doc: head.doc } });
      }
      if (write.outcome === RevisionOutcome.Invalid) {
        return refused(HTTP_BAD_REQUEST, { error: write.error });
      }
      return ok({ version: write.head.version });
    }
  }),

  apply_ops: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number(), ops: z.unknown(), summary: summaryInput }),
    run: async (ctx, input) => {
      const ops = parseOps(input.ops);
      if (!ops) {
        return refused(HTTP_BAD_REQUEST, { error: 'invalid_ops' });
      }
      const commit = await commitOps(ctx.db, { ...nodeScope(ctx), node: ctx.motion.node, baseVersion: input.version, ops, actor: ctx.actor, summary: input.summary || null, checkpoint: Checkpoint.Coalesce });
      if (commit.outcome === OpsOutcome.Invalid) {
        return refused(HTTP_BAD_REQUEST, { error: commit.error });
      }
      if (commit.outcome === OpsOutcome.Busy) {
        return refused(HTTP_CONFLICT, { error: 'busy' });
      }
      return ok({ version: commit.head.version, doc: commit.head.doc, rebased: commit.rebased });
    }
  }),

  record_export: op({
    access: EditorAccess.Write,
    input: z.object({ path: z.string(), width: z.number(), height: z.number(), seconds: z.number() }),
    run: async (ctx, input) => {
      const saved = await saveExport(ctx.db, { orgId: ctx.orgId, projectId: ctx.canvas.projectId, nodeId: ctx.motion.record.id, actor: ctx.actor, ...input });
      return saved.ok ? ok({ assetId: saved.assetId }) : refused(HTTP_BAD_REQUEST, { error: saved.error });
    }
  }),

  upload_font: op({
    access: EditorAccess.Write,
    input: z.object({ path: z.string() }),
    run: async (ctx, input) => {
      const saved = await saveFontUpload(ctx.db, { orgId: ctx.orgId, path: input.path });
      if (!saved.ok) {
        return refused(HTTP_BAD_REQUEST, { error: saved.error });
      }
      const assets = await motionAssets(placeOf(ctx));
      return ok({ font: saved.font, asset: assets.find((a) => a.id === saved.assetId) ?? null });
    }
  }),

  list_fonts: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => ok({ fonts: await orgFontFamilies(ctx.db, ctx.orgId) })
  }),

  rename_font: op({
    access: EditorAccess.Write,
    input: z.object({ family: z.string(), to: z.string() }),
    run: async (ctx, input) => changed(await renameFontFamily(ctx.db, { orgId: ctx.orgId, ...input }))
  }),

  delete_font: op({
    access: EditorAccess.Write,
    input: z.object({ family: z.string() }),
    run: async (ctx, input) => changed(await deleteFontFamily(ctx.db, { orgId: ctx.orgId, family: input.family }))
  }),

  analyze_sounds: op({
    access: EditorAccess.Write,
    input: z.object({ assetIds: z.array(z.string()) }),
    run: async (ctx, input) => {
      const assets = await motionAssets(placeOf(ctx));
      return ok({ analyses: await analyzeSounds(storageAnalysis(ctx.db), { orgId: ctx.orgId, projectId: ctx.canvas.projectId }, assets, input.assetIds) });
    }
  }),

  template_sounds: op({
    access: EditorAccess.Write,
    input: z.object({ doc: z.unknown(), clipId: z.string() }),
    run: async (ctx, input) => {
      const parsed = parseMotionDoc(input.doc);
      if (!parsed.ok) {
        return refused(HTTP_BAD_REQUEST, { error: parsed.error });
      }
      const make = (sfx: Sfx) => withOrgContext(ctx.orgId, () => laySfx(ctx.db, soundScope(ctx), sfx));
      const laid = await withTemplateSounds(parsed.doc, input.clipId, make, () => crypto.randomUUID().slice(0, SFX_ID_LENGTH));
      return laid.ok ? ok({ doc: laid.doc }) : refused(HTTP_UNAVAILABLE, { error: laid.error });
    }
  }),

  save_template: op({
    access: EditorAccess.Write,
    input: z.object({ doc: z.unknown(), compId: z.string().nullable().optional(), name: z.string(), description: z.string(), posterFrame: z.number().optional() }),
    run: async (ctx, input) => {
      const parsed = parseMotionDoc(input.doc);
      if (!parsed.ok) {
        return refused(HTTP_BAD_REQUEST, { error: parsed.error });
      }
      const saved = await templateLibrary(ctx.db, { orgId: ctx.orgId, actor: ctx.actor }).save({
        doc: parsed.doc,
        compId: input.compId || null,
        meta: { name: input.name, description: input.description },
        posterFrame: input.posterFrame || 0
      });
      return saved.ok ? ok({ entry: saved.entry }) : refused(HTTP_BAD_REQUEST, { error: saved.error });
    }
  }),

  generate_sound: op({
    access: EditorAccess.Write,
    input: z.object({ sound: z.string(), text: z.string(), seconds: z.number().optional() }),
    run: async (ctx, input) => {
      const sound = input.sound as Sound;
      const text = input.text.trim();
      if (!Object.values(Sound).includes(sound) || !text) {
        return refused(HTTP_BAD_REQUEST, { error: 'invalid_sound' });
      }
      const denied = await ctx.gate();
      if (denied) {
        return denied;
      }
      const made = await withOrgContext(ctx.orgId, () => generateSound(ctx.db, soundScope(ctx), sound, { text, seconds: input.seconds || undefined }));
      return made.ok ? ok({ assetId: made.assetId, seconds: made.seconds, url: made.url }) : refused(HTTP_UNAVAILABLE, { error: made.error });
    }
  }),

  render_batch: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number(), settings: z.unknown().optional(), rows: z.unknown() }),
    run: async (ctx, input) => {
      const settings = settingsFrom(input.settings);
      const rowsIn = rowsFrom(input.rows);
      if (!settings.ok) {
        return refused(HTTP_BAD_REQUEST, { error: settings.error });
      }
      if (!rowsIn.ok) {
        return refused(HTTP_BAD_REQUEST, { error: rowsIn.error });
      }
      const head = await headOrNew(ctx.db, nodeScope(ctx), ctx.motion.node);
      if (head.version !== input.version) {
        return refused(HTTP_CONFLICT, { error: 'save_first' });
      }
      const denied = await ctx.gate();
      if (denied) {
        return denied;
      }

      const [assets, tokens] = await Promise.all([motionAssets(placeOf(ctx), SIGNED_URL_TTL_S.render), motionTokens(ctx.db, { orgId: ctx.orgId, brandId: ctx.projectBrandId })]);
      const rows = rowRequests(head, rowsIn.rows, { tokens, assets: assetUrls(assets) }, settings.settings);
      if (!rows.ok) {
        return refused(HTTP_BAD_REQUEST, { error: 'invalid_row', detail: rows.error });
      }

      const editorUrl = motionEditorPath({ projectId: ctx.canvas.projectId, canvasId: ctx.canvas.id, nodeId: ctx.motion.record.id });
      const started = await startFarmBatch(ctx.db, { ...nodeScope(ctx), projectId: ctx.canvas.projectId, userId: ctx.userId, editorUrl }, rows.rows);
      return started.ok ? ok(started) : refused(HTTP_UNAVAILABLE, { error: started.error, detail: started.detail });
    }
  }),

  list_revisions: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => ok({ revisions: await namedRevisions(ctx.db, nodeScope(ctx)) })
  }),

  name_revision: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number().int().min(1), name: z.string().max(200) }),
    run: async (ctx, input) => {
      const out = await nameVersion(ctx.db, { ...nodeScope(ctx), ...input, actor: ctx.actor });
      return out.named ? ok({ named: true }) : refused(HTTP_NOT_FOUND, { error: out.error });
    }
  }),

  create_branch: op({
    access: EditorAccess.Write,
    input: z.object({ name: z.string().trim().min(1).max(BRANCH_NAME_MAX) }),
    run: async (ctx, input) => {
      const id = await createBranch(branchesOf(ctx), ctx.motion.record.id, input.name);
      return id ? ok({ branchId: id }) : refused(HTTP_NOT_FOUND, { error: 'frame_has_no_revision' });
    }
  }),

  list_branches: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => ok({ branches: await listBranches(branchesOf(ctx), ctx.motion.record.id) })
  }),

  review_branch: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => {
      const review = await reviewBranch(branchesOf(ctx), ctx.motion.record.id);
      return review ? ok({ fork: review.fork, conflicts: review.conflicts }) : refused(HTTP_BAD_REQUEST, { error: 'not_a_branch' });
    }
  }),

  merge_branch: op({
    access: EditorAccess.Write,
    input: z.object({ choices: z.record(z.string(), z.enum(Side)).default({}) }),
    run: async (ctx, input) => {
      const out = await mergeBranchBack(branchesOf(ctx), ctx.motion.record.id, input.choices);
      return out.outcome === BranchOutcome.Merged ? ok({ version: out.version }) : BRANCH_REFUSAL[out.outcome]();
    }
  }),

  drop_branch: op({
    access: EditorAccess.Write,
    input: z.object({}),
    run: async (ctx) => {
      const out = await dropBranch(branchesOf(ctx), ctx.motion.record.id);
      return out === BranchOutcome.Dropped ? ok({ dropped: true }) : BRANCH_REFUSAL[BranchOutcome.NotABranch]();
    }
  }),

  restore_revision: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number() }),
    run: async (ctx, input) => {
      const out = await restoreRevision(ctx.db, { ...nodeScope(ctx), node: ctx.motion.node, version: input.version, actor: ctx.actor });
      if (out.outcome === Restore.Missing) {
        return refused(HTTP_NOT_FOUND, { error: 'no_such_version' });
      }
      if (out.outcome === Restore.Conflict) {
        return refused(HTTP_CONFLICT, { error: 'conflict' });
      }
      return ok({ head: { version: out.head.version, doc: out.head.doc } });
    }
  }),

  export_still: op({
    access: EditorAccess.Write,
    input: z.object({ format: z.unknown().optional(), scale: z.unknown().optional() }),
    run: async (ctx, input) => {
      const ask = stillAskSchema.safeParse(input);
      if (!ask.success) {
        return refused(HTTP_BAD_REQUEST, { error: 'invalid_image_format' });
      }
      const [head, tokens, assets] = await Promise.all([
        headOrNew(ctx.db, nodeScope(ctx), ctx.motion.node),
        motionTokens(ctx.db, { orgId: ctx.orgId, brandId: ctx.projectBrandId }),
        motionAssets(placeOf(ctx), SIGNED_URL_TTL_S.render)
      ]);
      const made = await exportStill(ctx.db, { orgId: ctx.orgId, projectId: ctx.canvas.projectId, nodeId: ctx.motion.record.id }, head.doc, stillExport(ask.data.format, ask.data.scale), { tokens, assets });
      return made.ok ? ok(made) : refused(HTTP_UNAVAILABLE, { error: made.error });
    }
  }),

  start_render: op({
    access: EditorAccess.Write,
    input: z.object({ version: z.number(), settings: z.unknown().optional() }),
    run: async (ctx, input) => {
      const settings = settingsFrom(input.settings);
      if (!settings.ok) {
        return refused(HTTP_BAD_REQUEST, { error: settings.error });
      }
      const head = await headOrNew(ctx.db, nodeScope(ctx), ctx.motion.node);
      if (head.version !== input.version) {
        return refused(HTTP_CONFLICT, { error: 'save_first' });
      }
      const denied = await ctx.gate();
      if (denied) {
        return denied;
      }
      const editorUrl = motionEditorPath({ projectId: ctx.canvas.projectId, canvasId: ctx.canvas.id, nodeId: ctx.motion.record.id });
      const started = await startFarmRender(ctx.db, { ...nodeScope(ctx), projectId: ctx.canvas.projectId, canvasId: ctx.canvas.id, userId: ctx.userId, brandId: ctx.projectBrandId, editorUrl, head, settings: settings.settings });
      return started.ok ? ok({ runId: started.runId, quote: started.quote }) : refused(HTTP_UNAVAILABLE, { error: started.error, detail: started.detail });
    }
  }),

  cancel_render: op({
    access: EditorAccess.Write,
    input: z.object({}),
    run: async (ctx) => {
      const farm = motionRenderFarm();
      if (!farm) {
        return refused(HTTP_UNAVAILABLE, { error: 'rendering_not_configured' });
      }
      const cancelled = await cancelRender(ctx.db, farm, nodeScope(ctx));
      return cancelled.ok ? ok({ cancelled: true }) : refused(HTTP_CONFLICT, { error: 'nothing_to_cancel' });
    }
  }),

  delete_template: op({
    access: EditorAccess.Write,
    input: z.object({ id: z.string() }),
    run: async (ctx, input) => {
      const removed = await templateLibrary(ctx.db, { orgId: ctx.orgId, actor: ctx.actor }).remove(input.id);
      return removed ? ok({ removed: true }) : refused(HTTP_BAD_REQUEST, { error: 'not_removable' });
    }
  }),

  publish_gallery: op({
    access: EditorAccess.Write,
    input: z.object({ title: z.string(), description: z.string(), tags: z.string() }),
    run: async (ctx, input) => {
      const meta = { title: input.title, description: input.description, tags: splitTags(input.tags) };
      const published = await publishNode(userScope(ctx), { nodeId: ctx.motion.record.id, meta });
      return published.ok ? ok({ id: published.id }) : refused(publishStatus(published.error), { error: published.message });
    }
  }),

  withdraw_gallery: op({
    access: EditorAccess.Write,
    input: z.object({ id: z.string() }),
    run: async (ctx, input) => {
      const withdrawn = await withdrawFromGallery(ctx.db, { orgId: ctx.orgId, itemId: input.id });
      return withdrawn ? ok({ withdrawn: true }) : refused(HTTP_NOT_FOUND, { error: 'This item is not in the gallery.' });
    }
  }),

  render_status: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => ok({ render: renderView(await listNodeRuns(ctx.db, nodeScope(ctx))) })
  }),

  batch_status: op({
    access: EditorAccess.Read,
    input: z.object({}),
    run: async (ctx) => ok({ batch: batchView(await listNodeRuns(ctx.db, nodeScope(ctx))) })
  })
};

export type EditorOpName = keyof typeof EDITOR_OPS;

export function isEditorOp(name: string): name is EditorOpName {
  return Object.hasOwn(EDITOR_OPS, name);
}

export function runEditorOp<N extends EditorOpName>(name: N, ctx: EditorCtx, input: z.infer<(typeof EDITOR_OPS)[N]['input']>): Promise<EditorAnswer> {
  return (EDITOR_OPS[name].run as (ctx: EditorCtx, input: unknown) => Promise<EditorAnswer>)(ctx, input);
}
