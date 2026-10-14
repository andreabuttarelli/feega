import { z } from 'zod';
import type { Actor } from '$lib/server/repos/actor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { parseOps } from '$lib/motion/doc-ops';
import { OpsOutcome, commitOps } from '$lib/server/motion/frame-ops';
import { batchView, renderView } from '$lib/server/motion/render-run';
import type { MotionEditorScope } from '$lib/server/motion/editor-scope';
import { saveExport } from '$lib/server/motion/export';
import { saveFontUpload } from '$lib/server/motion/font-upload';
import { headOrNew, motionAssets, saveMotionDoc } from '$lib/server/motion/editor';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { templateLibrary } from '$lib/server/motion/templates';
import { withTemplateSounds } from '$lib/server/motion/template-sounds';
import { laySfx } from '$lib/server/motion/sfx';
import { withOrgContext } from '$lib/server/ai-log';
import { parseMotionDoc } from '$lib/motion/doc';
import type { Sfx } from '$lib/motion/sfx';

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
const HTTP_CONFLICT = 409;
const HTTP_UNAVAILABLE = 503;
const SFX_ID_LENGTH = 8;

const ok = (body: Record<string, unknown>): EditorAnswer => ({ status: HTTP_OK, body });
const refused = (status: number, body: Record<string, unknown>): EditorAnswer => ({ status, body });

const nodeScope = (ctx: EditorCtx) => ({ orgId: ctx.orgId, nodeId: ctx.motion.record.id });

const summaryInput = z.string().nullable().optional();

const placeOf = (ctx: EditorCtx) => ({ db: ctx.db, orgId: ctx.orgId, projectId: ctx.canvas.projectId, canvasId: ctx.canvas.id, nodeId: ctx.motion.record.id });

const soundScope = (ctx: EditorCtx) => ({ orgId: ctx.orgId, projectId: ctx.canvas.projectId, nodeId: ctx.motion.record.id, userId: ctx.userId, actor: ctx.actor });

export const EDITOR_OPS = {
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
        summary: input.summary || null
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
      const commit = await commitOps(ctx.db, { ...nodeScope(ctx), node: ctx.motion.node, baseVersion: input.version, ops, actor: ctx.actor, summary: input.summary || null });
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
      const saved = await saveFontUpload(ctx.db, { orgId: ctx.orgId, projectId: ctx.canvas.projectId, path: input.path });
      if (!saved.ok) {
        return refused(HTTP_BAD_REQUEST, { error: saved.error });
      }
      const assets = await motionAssets(placeOf(ctx));
      return ok({ asset: assets.find((a) => a.id === saved.assetId) ?? null });
    }
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
