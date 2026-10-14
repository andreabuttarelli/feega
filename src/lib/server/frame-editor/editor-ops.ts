import { z } from 'zod';
import type { Actor } from '$lib/server/repos/actor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { parseOps } from '$lib/motion/doc-ops';
import { headOrNew, saveMotionDoc } from '$lib/server/motion/editor';
import { OpsOutcome, commitOps } from '$lib/server/motion/frame-ops';
import { batchView, renderView } from '$lib/server/motion/render-run';
import type { MotionEditorScope } from '$lib/server/motion/editor-scope';

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

const ok = (body: Record<string, unknown>): EditorAnswer => ({ status: HTTP_OK, body });
const refused = (status: number, body: Record<string, unknown>): EditorAnswer => ({ status, body });

const nodeScope = (ctx: EditorCtx) => ({ orgId: ctx.orgId, nodeId: ctx.motion.record.id });

const summaryInput = z.string().nullable().optional();

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
