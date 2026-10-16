import { groupElements, moveNodeGroup, rotateNodeGroup, ungroupElement } from '$lib/server/motion/element-groups';
import { nodeMembers } from '$lib/server/motion/node-members';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import {
  createConnection,
  createNode,
  deleteConnection,
  findNode,
  listConnections,
  setConnectionMode,
  listCanvases,
  listNodes,
  moveNode,
  patchNodeData,
  DataCheck,
  type PatchWrite
} from '$lib/server/repos/canvas';
import { runGenNode, runsOf, type RunOutcome } from '$lib/server/canvas/generate';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { GEN_MEDIUMS, isGenMedium, type GenParams } from '$lib/canvas/gen-node';
import { connectRefusal, nodeModelError, targetTakesNoInputs, UNCENSORED_NO_INPUTS_ERROR } from '$lib/server/canvas/node-model';
import { unknownFieldsError, validateNewNodeData } from '$lib/canvas/node-data';
import { cancelLoop, enqueueLoop, planLoop, retryLoopCombo } from '$lib/server/canvas/loop';
import { GraphScope, enqueueGraph, planGraph } from '$lib/server/canvas/run-graph';
import { MoveOutcome, drawElement, drawnSchema, dropFor, frameAnswer, frameStore, linkFrame, moveElement, placeOutput } from '$lib/server/motion/move-element';
import { CanvasRemoval, openNewCanvas, removeCanvas, renameCanvasTo } from '$lib/server/canvas/lifecycle';
import { renameProject } from '$lib/server/repos/projects';
import { removeNodes, resizeOnCanvas, shareDoc, showRun } from '$lib/server/canvas/node-writes';
import { syncNode } from '$lib/server/canvas/node-sync';
import { duplicateNodes } from '$lib/server/canvas/duplicate';
import { insertTemplate } from '$lib/server/canvas/templates';
import { writeNodesBatch } from '$lib/server/canvas/batch-write';
import { pasteNodes } from '$lib/server/canvas/paste';
import { canvasSnapshot } from '$lib/server/canvas/snapshot';
import { canvasRevision } from '$lib/server/canvas/revision';
import { listMemberships } from '$lib/server/repos/orgs';
import { undoGesture } from '$lib/server/canvas/undo';
import { parseUndoItem, type UndoItem } from '$lib/canvas/undo-plan';
import { endOnboarding, runDemo } from '$lib/server/onboarding/first-run';
import { OnboardingStatus } from '$lib/onboarding/coach';
import { nextStepsFor, nodeTextCost } from '$lib/server/canvas/node-hints';
import { setCanvasShare } from '$lib/server/canvas/canvas-share';
import { ShareState } from '$lib/canvas/shared-view';
import { CANVAS_TEMPLATES } from '$lib/canvas/templates';
import { WIRE_MODES } from '$lib/canvas-edges';
import { cancelWorkflow, enqueueWorkflow, planWorkflowDryRun, workflowCredits } from '$lib/server/canvas/workflow';
import { FROM_TEMPLATE_DEPS, FromTemplate, startFromTemplate } from '$lib/server/motion/from-template';
import { MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import { cancelRender } from '$lib/server/motion/render-run';
import { motionRenderFarm } from '$lib/server/motion/renderer';
import { withdrawFromGallery } from '$lib/server/gallery/publish';
import { registerCanvasUpload, UploadError } from '$lib/server/canvas/upload';
import { canvasUploadPrefix, verdictForUpload } from '$lib/canvas/upload-kind';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { findProjectById } from '$lib/server/repos/projects';
import { configuredVoiceDeps } from '$lib/server/voices/voices-config';
import { cloneVoice, deleteVoice, designPreviews, saveDesignedVoice, voiceSlots, type Outcome, type VoiceDeps } from '$lib/server/voices/custom-voices';
import { CONSENT_BASES, MIN_VOICE_DESCRIPTION, VOICE_REFUSAL_MESSAGE, type ConsentBasis } from '$lib/canvas/voices';
import { ProjectMode } from '$lib/project-mode';
import { assetBreakdown, breakdownPorts } from '$lib/server/video-reference';

export type CanvasDeps = {
  db: Db;
  orgId: string;
  projectId: string;
  userId: string;
  brandId?: string | null;
};

export type CanvasCtx = CanvasDeps & {
  actor: Actor;
  billed: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function canvasCtx(deps: CanvasDeps): CanvasCtx {
  const billed = <T>(fn: () => Promise<T>): Promise<T> =>
    deps.brandId ? withBrandContext(deps.brandId, fn) : withOrgContext(deps.orgId, fn);
  return { ...deps, actor: agentActor(deps.userId), billed };
}

export const NODE_NOT_FOUND = { error: 'node_not_found', message: 'No live node with that id in this project.' };

const UNCENSORED_TARGET_REFUSED = {
  error: UNCENSORED_NO_INPUTS_ERROR,
  message: 'The target node uses an uncensored model, which takes no inputs of any kind. Switch its model first.'
};

export const AGENT_PATCH_ANSWERS: Record<PatchWrite['outcome'], (written: PatchWrite) => unknown> = {
  written: (written) => ({ outcome: 'written', node: (written as Extract<PatchWrite, { outcome: 'written' }>).node }),
  conflict: () => ({ outcome: 'conflict', message: 'Node kept changing while writing. Retry.' }),
  invalid: (written) => ({ outcome: 'invalid', message: (written as Extract<PatchWrite, { outcome: 'invalid' }>).error }),
  gone: () => NODE_NOT_FOUND
};

const BAD_MEDIUM = { error: 'bad_medium', message: `medium must be one of: ${GEN_MEDIUMS.join(', ')}.` };

export function outcomeOf(out: RunOutcome): Record<string, unknown> {
  if (out.kind === 'done') {
    return { outcome: 'done', runId: out.run.id, assetId: out.asset.id, assetType: out.asset.type };
  }
  if (out.kind === 'queued') {
    return { outcome: 'queued', runId: out.run.id, externalJobId: out.run.externalJobId };
  }
  if (out.kind === 'conflict') {
    return { outcome: 'conflict', message: 'Node was written by someone else. Re-read it and retry with the new version.' };
  }
  return { outcome: 'refused', error: out.error };
}

export enum Access {
  Read = 'read',
  Write = 'write',
  Spend = 'spend'
}

export enum Audience {
  Everyone = 'everyone',
  BytesSenders = 'bytes_senders'
}

type Op<S extends z.ZodType> = {
  access: Access;
  audience?: Audience;
  input: S;
  run: (ctx: CanvasCtx, input: z.infer<S>) => Promise<unknown>;
};

const op = <S extends z.ZodType>(o: Op<S>): Op<S> => o;

const listCanvasesInput = z.object({}).strict();
const listModelsInput = z.object({ medium: z.enum(GEN_MEDIUMS).describe('Which kind of node the models generate.') }).strict();
const listNodesInput = z.object({ canvasId: z.string().describe('Canvas id from list_canvases.') }).strict();
const createNodeInput = z
  .object({
    canvasId: z.string(),
    type: z.string(),
    x: z.number(),
    y: z.number(),
    displayName: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
const updateNodeInput = z
  .object({
    nodeId: z.string(),
    data: z.record(z.string(), z.unknown()).describe('Only the fields to change.')
  })
  .strict();
const moveNodeInput = z
  .object({
    nodeId: z.string(),
    x: z.number(),
    y: z.number(),
    z: z.number().optional().describe('Stacking order. Omit to leave it unchanged.')
  })
  .strict();
const frameTarget = {
  toFrameId: z.string().optional().describe('the Frame to put it in; omit to make a new Frame on the canvas'),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  canvasX: z.number().optional().describe('canvas position of a new Frame'),
  canvasY: z.number().optional()
};
const moveFrameElementInput = z.object({ frameId: z.string().describe('the Frame node the element is in'), elementId: z.string().describe('the clip id inside that frame'), ...frameTarget }).strict();
const placeInFrameInput = z.object({ nodeId: z.string().describe('the Generate image, Generate video or Generate text node'), ...frameTarget }).strict();

const drawElementInput = z
  .object({ canvasId: z.string(), drawn: drawnSchema.describe('{tool:text|rectangle|ellipse, box:{left,top,width,height}} in canvas units, or {tool:pen, path:SVG d in canvas units}') })
  .strict();

const groupElementsInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(2).max(50).describe('free elements on the canvas (frame nodes with data.kind element)') }).strict();
const ungroupElementInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a free element holding several shapes') }).strict();

const rotateGroupInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a Group on the canvas'), degrees: z.number().finite().describe('clockwise, added to its current angle') }).strict();
const moveGroupInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a Group on the canvas'), x: z.number().finite(), y: z.number().finite() }).strict();
const membersOf = (ctx: CanvasCtx, canvasId: string) => nodeMembers(ctx.db, { orgId: ctx.orgId, canvasId, actor: ctx.actor });

const framesOf = (ctx: CanvasCtx) => frameStore(ctx.db, { orgId: ctx.orgId, actor: ctx.actor, projectId: ctx.projectId });

const connectNodesInput = z
  .object({
    canvasId: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional()
  })
  .strict();
const nodeIdInput = z.object({ nodeId: z.string() }).strict();
const runNodeInput = z
  .object({
    nodeId: z.string(),
    medium: z.enum(GEN_MEDIUMS),
    prompt: z.string().optional().describe('Omit to keep the prompt already on the node.'),
    model: z.string().optional().describe('Omit to keep the model already on the node.'),
    params: z.record(z.string(), z.unknown()).optional().describe('e.g. { aspectRatio: "1:1", duration: 8 }.'),
    provider: z.string().optional().describe('A provider id from list_models routes (e.g. "kie", "openrouter"); omit or "auto" for the cheapest healthy one.'),
    expectedVersion: z.number().int()
  })
  .strict();

const runLoopInput = z
  .object({
    nodeId: z.string(),
    confirm: z.boolean().optional().describe('Required true above 50 combinations, after the user agreed to the cost.')
  })
  .strict();

const runGraphInput = z
  .object({
    graph: z.enum(GraphScope).describe('downstream: nodeId and every node it feeds, in order. stale: results older than their inputs.'),
    nodeId: z.string().optional().describe('downstream: the node to start from.'),
    canvasId: z.string().optional().describe('stale: the canvas.'),
    nodeIds: z.array(z.string()).optional().describe('stale: only these nodes. Omit for the whole canvas.')
  })
  .strict();

const NO_CANVAS = { error: 'canvas_required', message: 'downstream needs nodeId; stale needs canvasId.' };

async function graphCanvas(ctx: CanvasCtx, input: z.infer<typeof runGraphInput>): Promise<string | null> {
  if (input.graph === GraphScope.Stale) {
    return input.canvasId ?? null;
  }
  const node = input.nodeId ? await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId }) : null;
  return node?.canvasId ?? null;
}

const canvasIdInput = z.object({ canvasId: z.string() }).strict();
const renameCanvasInput = z.object({ canvasId: z.string(), name: z.string().min(1) }).strict();
const renameProjectInput = z.object({ name: z.string().min(1) }).strict();
const connectionIdInput = z.object({ connectionId: z.string().describe('from list_connections') }).strict();
const edgeModeInput = z.object({ connectionId: z.string(), mode: z.enum(WIRE_MODES).describe('iterate makes the line a loop axis') }).strict();
const resizeNodeInput = z.object({ nodeId: z.string(), width: z.number().positive(), height: z.number().positive() }).strict();
const nodeIdsInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(1) }).strict();
const shareCanvasInput = z.object({ canvasId: z.string(), on: z.boolean().describe('true mints a view-only link; false revokes it') }).strict();
const shareDocInput = z.object({ nodeId: z.string().describe('a doc node'), on: z.boolean() }).strict();
const insertTemplateInput = z.object({ canvasId: z.string(), templateId: z.string().describe('from list_templates'), x: z.number(), y: z.number() }).strict();
const addFrameInput = z
  .object({
    canvasId: z.string(),
    templateId: z.string().describe('a motion template id (list_motion_templates)'),
    format: z.enum(MOTION_FORMATS).default(MotionFormat.Landscape),
    x: z.number(),
    y: z.number()
  })
  .strict();
const showRunInput = z.object({ nodeId: z.string(), runId: z.string().describe('from list_runs') }).strict();
const retryComboInput = z.object({ nodeId: z.string(), outputListNodeId: z.string(), label: z.string(), runId: z.string().optional() }).strict();
const workflowIdInput = z.object({ workflowId: z.string() }).strict();
const workflowInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(2) }).strict();
const writeNodesInput = z
  .object({
    canvasId: z.string(),
    items: z
      .array(z.object({ node_id: z.string(), version: z.number().int().describe('the version read'), patch: z.record(z.string(), z.unknown()) }).strict())
      .min(1)
  })
  .strict();
const pasteNodesInput = z
  .object({
    canvasId: z.string(),
    nodes: z.array(z.object({ type: z.string(), data: z.record(z.string(), z.unknown()), x: z.number(), y: z.number() }).strict()).min(1),
    edges: z
      .array(
        z
          .object({
            sourceIndex: z.number().int().describe('index in nodes'),
            targetIndex: z.number().int(),
            sourceHandle: z.string().nullable().default(null),
            targetHandle: z.string().nullable().default(null)
          })
          .strict()
      )
      .default([])
  })
  .strict();
const undoGestureInput = z
  .object({ canvasId: z.string(), items: z.array(z.unknown()).min(1).describe('the gesture items the canvas recorded, newest write first') })
  .strict();
const endOnboardingInput = z.object({ status: z.enum([OnboardingStatus.Dismissed, OnboardingStatus.Completed]) }).strict();
const textCostInput = z
  .object({ canvasId: z.string(), nodeId: z.string(), prompt: z.string().default(''), model: z.string().optional().describe('Omit for the default text model.') })
  .strict();
const nodeOnCanvasInput = z.object({ canvasId: z.string(), nodeId: z.string() }).strict();
const INVALID_GESTURE = { error: 'invalid_gesture' };
const CHAIN_INCOMPLETE = { error: 'chain_incomplete' };
const galleryItemInput = z.object({ itemId: z.string() }).strict();
const videoReferenceInput = z.object({ assetId: z.string().describe('A video asset of this project or the library: a video node data.assetId or a chat attachment.') }).strict();

const MAX_VOICE_NAME = 100;
const MAX_CLONE_SAMPLE_BYTES = 3 * 1024 * 1024;

const requestUploadInput = z.object({ fileName: z.string().min(1), mimeType: z.string().min(1), bytes: z.number().int().positive() }).strict();
const registerUploadInput = z
  .object({
    canvasId: z.string(),
    path: z.string().describe('from request_upload, after the bytes were PUT to its uploadUrl'),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    bytes: z.number().int().positive(),
    x: z.number().default(0),
    y: z.number().default(0)
  })
  .strict();
const voiceLibraryInput = z
  .object({ search: z.string().optional(), language: z.string().optional(), gender: z.string().optional(), accent: z.string().optional(), useCase: z.string().optional(), page: z.number().int().min(0).optional() })
  .strict();
const voiceName = z.string().trim().min(1).transform((name) => name.slice(0, MAX_VOICE_NAME));
const useLibraryVoiceInput = z.object({ ownerId: z.string().min(1), voiceId: z.string().min(1), name: voiceName }).strict();
const designVoiceInput = z.object({ description: z.string().trim().min(MIN_VOICE_DESCRIPTION) }).strict();
const saveVoiceInput = z.object({ generatedVoiceId: z.string().min(1), name: voiceName, description: z.string().default('') }).strict();
const cloneVoiceInput = z
  .object({
    name: voiceName,
    consentBasis: z.enum(Object.keys(CONSENT_BASES) as [ConsentBasis, ...ConsentBasis[]]),
    speaker: z.string().default('').describe('consented_speaker: the name of the person who consented'),
    attested: z.boolean().describe('true only when the user confirmed the consent'),
    seconds: z.number().describe('length of the recording'),
    sampleBase64: z.string().min(1).describe(`the recording, base64, at most ${MAX_CLONE_SAMPLE_BYTES / 1024 / 1024}MB`),
    mimeType: z.string().default('audio/mpeg')
  })
  .strict();
const voiceIdInput = z.object({ id: z.string().describe('a custom voice id from list_voices') }).strict();

const NOT_IN_PROJECT = { error: 'canvas_not_found', message: 'No canvas with that id in this project.' };
const LAST_CANVAS = { error: 'last_canvas', message: 'A project keeps at least one canvas.' };
const NO_FARM = { error: 'rendering_not_configured' };
const NOT_SYNCABLE = { error: 'not_syncable', message: 'Only products and social_account_feed nodes sync.' };

const VOICES_OFF = { error: 'elevenlabs_not_configured' };
const SAMPLE_TOO_LARGE = { error: 'recording_too_large', message: `The recording is over ${MAX_CLONE_SAMPLE_BYTES / 1024 / 1024}MB.` };

function voiceAnswer<T extends object>(out: Outcome<T>): unknown {
  if (out.ok) {
    return out;
  }
  const message = out.error === 'voice_not_found' ? 'This voice does not exist.' : VOICE_REFUSAL_MESSAGE[out.error];
  return { error: out.error, message };
}

async function withVoices(ctx: CanvasCtx, work: (deps: VoiceDeps) => Promise<unknown>): Promise<unknown> {
  const deps = configuredVoiceDeps(ctx.db);
  return deps ? work(deps) : VOICES_OFF;
}

const voiceScope = (ctx: CanvasCtx) => ({ orgId: ctx.orgId, userId: ctx.userId, actor: ctx.actor });

async function projectMode(ctx: CanvasCtx): Promise<ProjectMode> {
  return (await findProjectById(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }))?.mode ?? ProjectMode.Standard;
}

const safeFileName = (name: string) => name.replace(/[\\/]/g, '_').replace(/\.\.+/g, '.');

async function uploadAnswer(work: () => Promise<unknown>): Promise<unknown> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof UploadError) {
      return { error: 'invalid_upload', message: cause.message };
    }
    throw cause;
  }
}

async function inProject(ctx: CanvasCtx, canvasId: string): Promise<boolean> {
  return (await listCanvases(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId })).some((c) => c.id === canvasId);
}

export const CANVAS_OPS = {
  list_canvases: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) => ({ canvases: await listCanvases(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }) })
  }),

  list_nodes: op({
    access: Access.Read,
    input: listNodesInput,
    run: async (ctx, input) => ({ nodes: await listNodes(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId }) })
  }),

  canvas_snapshot: op({
    access: Access.Read,
    input: canvasIdInput,
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? canvasSnapshot(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId }) : NOT_IN_PROJECT)
  }),

  canvas_revision: op({
    access: Access.Read,
    input: canvasIdInput,
    run: async (ctx, input) => {
      const memberships = (await listMemberships(ctx.db, ctx.userId)).filter((m) => m.org.id === ctx.orgId);
      return canvasRevision(ctx.db, { canvasId: input.canvasId, projectId: ctx.projectId, memberships });
    }
  }),

  create_node: op({
    access: Access.Write,
    input: createNodeInput,
    run: async (ctx, input) => {
      const verdict = validateNewNodeData(input.type, input.data ?? {});
      if (!verdict.ok) {
        return { outcome: 'invalid', message: verdict.error };
      }
      const badModel = await nodeModelError(input.type, input.data);
      if (badModel) {
        return { outcome: 'invalid', message: badModel };
      }

      const node = await createNode(ctx.db, {
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        canvasId: input.canvasId,
        type: input.type,
        x: input.x,
        y: input.y,
        displayName: input.displayName ?? null,
        data: verdict.data,
        actor: ctx.actor
      });
      return { outcome: 'written', node };
    }
  }),

  update_node: op({
    access: Access.Write,
    input: updateNodeInput,
    run: async (ctx, input) => {
      const current = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!current) {
        return NODE_NOT_FOUND;
      }
      const unknown = unknownFieldsError(current.type, input.data);
      if (unknown) {
        return { outcome: 'invalid', message: unknown };
      }
      const badModel = await nodeModelError(current.type, input.data);
      if (badModel) {
        return { outcome: 'invalid', message: badModel };
      }

      const written = await patchNodeData(ctx.db, {
        orgId: ctx.orgId,
        nodeId: input.nodeId,
        patch: input.data,
        check: DataCheck.Schema,
        actor: ctx.actor
      });
      return AGENT_PATCH_ANSWERS[written.outcome](written);
    }
  }),

  move_node: op({
    access: Access.Write,
    input: moveNodeInput,
    run: async (ctx, input) => {
      const node = await moveNode(ctx.db, { orgId: ctx.orgId, ...input, actor: ctx.actor });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      return { node };
    }
  }),

  write_nodes: op({
    access: Access.Write,
    input: writeNodesInput,
    run: async (ctx, input) =>
      (await inProject(ctx, input.canvasId))
        ? { results: await writeNodesBatch(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, items: input.items, actor: ctx.actor }) }
        : NOT_IN_PROJECT
  }),

  paste_nodes: op({
    access: Access.Write,
    input: pasteNodesInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const out = await pasteNodes(ctx.db, { ...input, orgId: ctx.orgId, projectId: ctx.projectId, actor: ctx.actor });
      return 'refused' in out ? { error: 'invalid_data', message: out.refused } : out;
    }
  }),

  estimate_text_cost: op({
    access: Access.Read,
    input: textCostInput,
    run: async (ctx, input) =>
      (await inProject(ctx, input.canvasId))
        ? nodeTextCost(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, nodeId: input.nodeId, prompt: input.prompt, model: input.model || null })
        : NOT_IN_PROJECT
  }),

  suggest_next_steps: op({
    access: Access.Read,
    input: nodeOnCanvasInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const suggestions = await nextStepsFor(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, nodeId: input.nodeId });
      return suggestions ? { suggestions } : NODE_NOT_FOUND;
    }
  }),

  undo_gesture: op({
    access: Access.Write,
    input: undoGestureInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const items = input.items.map(parseUndoItem);
      if (items.some((item) => item === null)) {
        return INVALID_GESTURE;
      }
      const result = await undoGesture(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, gesture: { items: items as UndoItem[] }, actor: ctx.actor });
      return result.outcome === 'refused' ? { outcome: 'refused', reason: result.reason } : { outcome: 'undone', redo: result.redo };
    }
  }),

  run_demo: op({
    access: Access.Write,
    input: canvasIdInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const nodes = await runDemo(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, actor: ctx.actor });
      return nodes ? { nodes } : CHAIN_INCOMPLETE;
    }
  }),

  end_onboarding: op({
    access: Access.Write,
    input: endOnboardingInput,
    run: async (ctx, input) => ({ ended: await endOnboarding(ctx.db, ctx.userId, input.status) })
  }),

  connect_nodes: op({
    access: Access.Write,
    input: connectNodesInput,
    run: async (ctx, input) => {
      if (await targetTakesNoInputs(ctx.db, { orgId: ctx.orgId, targetNodeId: input.targetNodeId })) {
        return UNCENSORED_TARGET_REFUSED;
      }

      const refusal = await connectRefusal(ctx.db, { orgId: ctx.orgId, sourceNodeId: input.sourceNodeId, targetNodeId: input.targetNodeId });
      if (refusal) {
        return { error: 'edge_refused', message: refusal };
      }

      const connection = await createConnection(ctx.db, {
        orgId: ctx.orgId,
        canvasId: input.canvasId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        sourceHandle: input.sourceHandle ?? null,
        targetHandle: input.targetHandle ?? null,
        actor: ctx.actor
      });
      const linked = await linkFrame(framesOf(ctx), { sourceNodeId: input.sourceNodeId, frameNodeId: input.targetNodeId });
      return { connection, ...(linked.outcome === MoveOutcome.Done ? { placed_in_frame: { clip_id: linked.clipId, revision: linked.versions[linked.frameId] } } : {}) };
    }
  }),

  move_frame_element: op({
    access: Access.Write,
    input: moveFrameElementInput,
    run: async (ctx, input) => frameAnswer(await moveElement(framesOf(ctx), { sourceNodeId: input.frameId, clipId: input.elementId, drop: dropFor(input) }))
  }),

  draw_element: op({
    access: Access.Write,
    input: drawElementInput,
    run: async (ctx, input) => frameAnswer(await drawElement(framesOf(ctx), { projectId: ctx.projectId, canvasId: input.canvasId }, input.drawn))
  }),

  group_elements: op({
    access: Access.Write,
    input: groupElementsInput,
    run: async (ctx, input) => frameAnswer(await groupElements(framesOf(ctx), membersOf(ctx, input.canvasId), { projectId: ctx.projectId, canvasId: input.canvasId }, input.nodeIds))
  }),

  ungroup_element: op({
    access: Access.Write,
    input: ungroupElementInput,
    run: async (ctx, input) => frameAnswer(await ungroupElement(framesOf(ctx), membersOf(ctx, input.canvasId), { projectId: ctx.projectId, canvasId: input.canvasId }, input.nodeId))
  }),

  rotate_group: op({
    access: Access.Write,
    input: rotateGroupInput,
    run: async (ctx, input) => frameAnswer(await rotateNodeGroup(framesOf(ctx), membersOf(ctx, input.canvasId), input.nodeId, input.degrees))
  }),

  move_group: op({
    access: Access.Write,
    input: moveGroupInput,
    run: async (ctx, input) => frameAnswer(await moveNodeGroup(membersOf(ctx, input.canvasId), input.nodeId, { x: input.x, y: input.y }))
  }),

  place_in_frame: op({
    access: Access.Write,
    input: placeInFrameInput,
    run: async (ctx, input) => frameAnswer(await placeOutput(framesOf(ctx), { sourceNodeId: input.nodeId, drop: dropFor(input) }))
  }),

  delete_node: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      await removeNodes(ctx.db, { orgId: ctx.orgId, canvasId: node.canvasId, nodeIds: [node.id], actor: ctx.actor });
      return { deleted: true, nodeId: input.nodeId };
    }
  }),

  run_node: op({
    access: Access.Spend,
    input: runNodeInput,
    run: async (ctx, input) => {
      const medium = input.medium;
      if (!isGenMedium(medium)) {
        return BAD_MEDIUM;
      }

      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }

      const data = node.data as { prompt?: string; model?: string; params?: GenParams };
      const out = await ctx.billed(() =>
        runGenNode(ctx.db, {
          orgId: ctx.orgId,
          projectId: ctx.projectId,
          canvasId: node.canvasId,
          nodeId: node.id,
          userId: ctx.userId,
          medium,
          prompt: input.prompt ?? data.prompt ?? '',
          model: input.model ?? data.model ?? null,
          params: { ...(input.params ?? data.params ?? {}), ...(input.provider ? { provider: input.provider } : {}) } as GenParams,
          expectedVersion: input.expectedVersion,
          actor: ctx.actor
        })
      );

      return outcomeOf(out);
    }
  }),

  list_models: op({
    access: Access.Read,
    input: listModelsInput,
    run: async (ctx, input) => {
      const [{ projectCatalogue, listedModel }, { projectModeOf }] = await Promise.all([
        import('$lib/server/project-catalogue'),
        import('$lib/server/uncensored-workspace/workspace-server')
      ]);
      const mode = await projectModeOf(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId });
      const catalogue = await projectCatalogue(ctx.db, { orgId: ctx.orgId, mode });
      return { models: catalogue[input.medium].choices.map(listedModel) };
    }
  }),

  list_runs: op({
    access: Access.Read,
    input: nodeIdInput,
    run: async (ctx, input) => ({ runs: await runsOf(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId }) })
  }),

  preview_node_loop: op({
    access: Access.Read,
    input: nodeIdInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      return planLoop(ctx.db, { orgId: ctx.orgId, canvasId: node.canvasId, nodeId: node.id });
    }
  }),

  run_node_loop: op({
    access: Access.Spend,
    input: runLoopInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      return enqueueLoop(ctx.db, {
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        canvasId: node.canvasId,
        nodeId: node.id,
        userId: ctx.userId,
        confirmed: input.confirm === true,
        actor: ctx.actor
      });
    }
  }),

  cancel_node_loop: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => cancelLoop(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId })
  }),

  preview_run_graph: op({
    access: Access.Read,
    input: runGraphInput,
    run: async (ctx, input) => {
      const canvasId = await graphCanvas(ctx, input);
      if (!canvasId) {
        return NO_CANVAS;
      }
      const { plan, credits } = await planGraph(ctx.db, { orgId: ctx.orgId, canvasId, ...input });
      return plan.ok ? { steps: plan.steps, credits } : { outcome: 'refused', error: plan.reason };
    }
  }),

  run_graph: op({
    access: Access.Spend,
    input: runGraphInput,
    run: async (ctx, input) => {
      const canvasId = await graphCanvas(ctx, input);
      if (!canvasId) {
        return NO_CANVAS;
      }
      const out = await ctx.billed(() =>
        enqueueGraph(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, actor: ctx.actor, canvasId, ...input })
      );
      return out.kind === 'enqueued'
        ? { outcome: 'queued', workflowId: out.workflowId, steps: out.steps, runIdByNodeId: out.runIdByNodeId, credits: out.credits }
        : { outcome: 'refused', error: out.error };
    }
  }),

  create_canvas: op({
    access: Access.Write,
    input: listCanvasesInput,
    run: async (ctx) => ({ canvas: await openNewCanvas(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }) })
  }),

  rename_canvas: op({
    access: Access.Write,
    input: renameCanvasInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      return { renamed: await renameCanvasTo(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, name: input.name }) };
    }
  }),

  delete_canvas: op({
    access: Access.Write,
    input: canvasIdInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const removed = await removeCanvas(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId });
      return removed.outcome === CanvasRemoval.LastCanvas ? LAST_CANVAS : { deleted: true, nextCanvasId: removed.nextCanvasId };
    }
  }),

  rename_project: op({
    access: Access.Write,
    input: renameProjectInput,
    run: async (ctx, input) => {
      await renameProject(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, name: input.name.trim() });
      return { renamed: true };
    }
  }),

  list_connections: op({
    access: Access.Read,
    input: canvasIdInput,
    run: async (ctx, input) => ({ connections: await listConnections(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId }) })
  }),

  disconnect_nodes: op({
    access: Access.Write,
    input: connectionIdInput,
    run: async (ctx, input) => {
      await deleteConnection(ctx.db, { orgId: ctx.orgId, connectionId: input.connectionId, actor: ctx.actor });
      return { disconnected: true };
    }
  }),

  set_edge_mode: op({
    access: Access.Write,
    input: edgeModeInput,
    run: async (ctx, input) => {
      const connection = await setConnectionMode(ctx.db, { orgId: ctx.orgId, ...input });
      return connection ? { connection } : { error: 'connection_not_found' };
    }
  }),

  resize_node: op({
    access: Access.Write,
    input: resizeNodeInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      await resizeOnCanvas(ctx.db, { orgId: ctx.orgId, canvasId: node.canvasId, ...input });
      return { resized: true };
    }
  }),

  duplicate_nodes: op({
    access: Access.Write,
    input: nodeIdsInput,
    run: async (ctx, input) => duplicateNodes(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, ...input, actor: ctx.actor })
  }),

  share_canvas: op({
    access: Access.Write,
    input: shareCanvasInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const token = await setCanvasShare(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, state: input.on ? ShareState.On : ShareState.Off });
      return token ? { shared: true, path: `/s/${token}` } : { shared: false };
    }
  }),

  share_doc: op({
    access: Access.Write,
    input: shareDocInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      const shared = node ? await shareDoc(ctx.db, { orgId: ctx.orgId, canvasId: node.canvasId, ...input }) : null;
      return shared ?? NODE_NOT_FOUND;
    }
  }),

  list_templates: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async () => ({ templates: CANVAS_TEMPLATES.map((t) => ({ id: t.id, category: t.category, name: t.name, description: t.description })) })
  }),

  insert_template: op({
    access: Access.Write,
    input: insertTemplateInput,
    run: async (ctx, input) => {
      const out = await insertTemplate(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, templateId: input.templateId, at: { x: input.x, y: input.y }, actor: ctx.actor });
      return out ?? { error: 'unknown_template' };
    }
  }),

  add_frame_from_template: op({
    access: Access.Write,
    input: addFrameInput,
    run: async (ctx, input) => {
      const started = await startFromTemplate(ctx.db, FROM_TEMPLATE_DEPS, {
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        canvasId: input.canvasId,
        userId: ctx.userId,
        templateId: input.templateId,
        format: input.format,
        at: { x: input.x, y: input.y },
        actor: ctx.actor
      });
      return started.outcome === FromTemplate.Started ? { outcome: 'written', nodeId: started.start.nodeId, version: started.version } : { error: started.outcome };
    }
  }),

  show_run: op({
    access: Access.Write,
    input: showRunInput,
    run: async (ctx, input) => showRun(ctx.db, { orgId: ctx.orgId, ...input, actor: ctx.actor })
  }),

  sync_node: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      const written = await syncNode(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, nodeId: node.id, version: node.version, actor: ctx.actor });
      return written.outcome === 'not_syncable' ? NOT_SYNCABLE : AGENT_PATCH_ANSWERS[written.outcome](written);
    }
  }),

  retry_loop_combination: op({
    access: Access.Spend,
    input: retryComboInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      const ask = { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: node.canvasId, userId: ctx.userId, nodeId: node.id, outputListNodeId: input.outputListNodeId, label: input.label, runId: input.runId ?? null, actor: ctx.actor };
      return ctx.billed(() => retryLoopCombo(ctx.db, ask));
    }
  }),

  preview_workflow: op({
    access: Access.Read,
    input: workflowInput,
    run: async (ctx, input) => {
      const plan = await planWorkflowDryRun(ctx.db, { orgId: ctx.orgId, ...input });
      if (!plan.ok) {
        return { outcome: 'refused', error: plan.reason };
      }
      return { steps: plan.steps, credits: await workflowCredits(ctx.db, { orgId: ctx.orgId, nodeIds: input.nodeIds }) };
    }
  }),

  run_workflow: op({
    access: Access.Spend,
    input: workflowInput,
    run: async (ctx, input) => {
      const out = await ctx.billed(() => enqueueWorkflow(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, ...input }));
      return out.kind === 'refused' ? { outcome: 'refused', error: out.error } : { outcome: 'queued', workflowId: out.workflowId, steps: out.steps };
    }
  }),

  cancel_workflow: op({
    access: Access.Write,
    input: workflowIdInput,
    run: async (ctx, input) => cancelWorkflow(ctx.db, { orgId: ctx.orgId, workflowId: input.workflowId })
  }),

  cancel_render: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => {
      const farm = motionRenderFarm();
      if (!farm) {
        return NO_FARM;
      }
      const cancelled = await cancelRender(ctx.db, farm, { orgId: ctx.orgId, nodeId: input.nodeId });
      return cancelled.ok ? { cancelled: true } : { error: 'nothing_to_cancel' };
    }
  }),

  request_upload: op({
    access: Access.Write,
    audience: Audience.BytesSenders,
    input: requestUploadInput,
    run: async (ctx, input) => {
      const verdict = verdictForUpload(input.mimeType, input.fileName, input.bytes);
      if (!verdict.ok) {
        return { error: 'invalid_upload', message: verdict.why };
      }
      const path = `${canvasUploadPrefix(ctx.orgId, ctx.projectId)}${crypto.randomUUID()}-${safeFileName(input.fileName)}`;
      const { data, error } = await ctx.db.storage.from(CANVAS_ASSET_BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        return { error: 'upload_not_signed', message: error?.message };
      }
      return { path, uploadUrl: data.signedUrl, kind: verdict.kind, then: 'PUT the bytes to uploadUrl with the Content-Type, then register_upload with this path.' };
    }
  }),

  register_upload: op({
    access: Access.Write,
    audience: Audience.BytesSenders,
    input: registerUploadInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      return uploadAnswer(() => registerCanvasUpload(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, ...input }));
    }
  }),

  list_voices: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) =>
      withVoices(ctx, async (deps) => {
        const [custom, slots] = await Promise.all([deps.store.list(ctx.orgId), voiceSlots(deps, ctx.orgId)]);
        return { custom, slots };
      })
  }),

  voice_library: op({
    access: Access.Read,
    input: voiceLibraryInput,
    run: async (ctx, input) => withVoices(ctx, (deps) => deps.provider.library({ ...input, page: input.page ?? 0 }))
  }),

  use_library_voice: op({
    access: Access.Write,
    input: useLibraryVoiceInput,
    run: async (ctx, input) => withVoices(ctx, async (deps) => ({ voiceId: await deps.provider.addShared(input), name: input.name }))
  }),

  design_voice: op({
    access: Access.Spend,
    input: designVoiceInput,
    run: async (ctx, input) => withVoices(ctx, async (deps) => voiceAnswer(await ctx.billed(() => designPreviews(deps, voiceScope(ctx), input))))
  }),

  save_voice: op({
    access: Access.Write,
    input: saveVoiceInput,
    run: async (ctx, input) => withVoices(ctx, async (deps) => voiceAnswer(await saveDesignedVoice(deps, voiceScope(ctx), input)))
  }),

  clone_voice: op({
    access: Access.Spend,
    audience: Audience.BytesSenders,
    input: cloneVoiceInput,
    run: async (ctx, input) => {
      const bytes = new Uint8Array(Buffer.from(input.sampleBase64, 'base64'));
      if (bytes.byteLength > MAX_CLONE_SAMPLE_BYTES) {
        return SAMPLE_TOO_LARGE;
      }
      const mode = await projectMode(ctx);
      const ask = { name: input.name, consentBasis: input.consentBasis, speaker: input.speaker, attested: input.attested, seconds: input.seconds, mode, samples: [{ bytes, mime: input.mimeType }] };
      return withVoices(ctx, async (deps) => voiceAnswer(await ctx.billed(() => cloneVoice(deps, voiceScope(ctx), ask))));
    }
  }),

  delete_voice: op({
    access: Access.Write,
    input: voiceIdInput,
    run: async (ctx, input) => withVoices(ctx, async (deps) => {
      const out = await deleteVoice(deps, ctx.orgId, input.id);
      return out.ok ? { deleted: true } : voiceAnswer(out);
    })
  }),

  read_video_reference: op({
    access: Access.Spend,
    input: videoReferenceInput,
    run: async (ctx, input) => {
      const scope = { orgId: ctx.orgId, projectId: ctx.projectId, mode: await projectMode(ctx) };
      return ctx.billed(() => assetBreakdown(ctx.db, breakdownPorts(scope), { ...scope, assetId: input.assetId }));
    }
  }),

  withdraw_from_gallery: op({
    access: Access.Write,
    input: galleryItemInput,
    run: async (ctx, input) => ({ withdrawn: await withdrawFromGallery(ctx.db, { orgId: ctx.orgId, itemId: input.itemId }) })
  })
};

export type CanvasOpName = keyof typeof CANVAS_OPS;

export function isCanvasOp(name: string): name is CanvasOpName {
  return Object.hasOwn(CANVAS_OPS, name);
}

export function chatSendsOp(name: CanvasOpName): boolean {
  return (CANVAS_OPS[name].audience ?? Audience.Everyone) === Audience.Everyone;
}
