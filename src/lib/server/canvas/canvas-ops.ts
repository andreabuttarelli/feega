import { exportCodeNode } from '$lib/server/canvas/code-export-node';
import { listProjectComponents } from './project-components';
import { ExportMode } from '$lib/canvas/code-frame';
import { codeVarsError } from '$lib/server/canvas/code-source';
import { groupElements, moveNodeGroup, rotateNodeGroup, scaleNodeGroup, stackElements, ungroupElement } from '$lib/server/motion/element-groups';
import { nodeMembers } from '$lib/server/motion/node-members';
import { wrapInSection } from './section';
import { z } from 'zod';
import { COLOUR_TAGS, withColour } from '$lib/canvas/node-colour';
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
import { cancelNodeRun, runsOf } from '$lib/server/canvas/generate';
import { diffRuns } from '$lib/canvas/run-diff';
import { runGeneration, type GenerationOutcome } from '$lib/server/canvas/variants';
import { cancelBatch } from '$lib/server/canvas/cancel-batch';
import { parseVariantsAsk } from '$lib/canvas/variants';
import { IMAGE_TOOL_DEPS, startImageTool } from '$lib/server/canvas/image-tool';
import { layersToFrame, layersToFrameDeps } from '$lib/server/canvas/layers-to-frame';
import { imageToolAskSchema } from '$lib/image-tools';
import { videoReframeAskSchema } from '$lib/reframe';
import { VIDEO_REFRAME_DEPS, startVideoReframe } from '$lib/server/canvas/video-reframe';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { GEN_MEDIUMS, isGenMedium, type GenParams } from '$lib/canvas/gen-node';
import { connectRefusal, nodeModelError, targetTakesNoInputs, UNCENSORED_NO_INPUTS_ERROR } from '$lib/server/canvas/node-model';
import { unknownFieldsError, validateNewNodeData } from '$lib/canvas/node-data';
import { enqueueLoop, planLoop, retryLoopCombo } from '$lib/server/canvas/loop';
import { GraphScope, enqueueGraph, planGraph } from '$lib/server/canvas/run-graph';
import { canvasStyle, canvasStyleInput } from '$lib/server/motion/canvas-styles';
import { canvasVariable, canvasVariableInput } from '$lib/server/motion/canvas-variables';
import { importLottieAt } from '$lib/server/motion/lottie-at';
import { lottieSource } from '$lib/motion/import-lottie';
import { SafeFetchError, safeFetchBytes } from '$lib/server/tool-guard';
import { MoveOutcome, drawElement, drawFrameAt, drawnSchema, dropFor, frameAnswer, frameStore, moveElement, copyElement, placeComponent, placeOutput } from '$lib/server/motion/move-element';
import { CanvasRemoval, openNewCanvas, removeCanvas, renameCanvasTo } from '$lib/server/canvas/lifecycle';
import { renameProject } from '$lib/server/repos/projects';
import { NODE_NAME_MAX } from '$lib/canvas/node-name';
import { removeNodes, renameOnCanvas, resizeOnCanvas, shareDoc, showRun } from '$lib/server/canvas/node-writes';
import { syncNode } from '$lib/server/canvas/node-sync';
import { duplicateNodes } from '$lib/server/canvas/duplicate';
import { addComment, deleteComment, editComment, listComments, resolveThread, teammates } from '$lib/server/canvas/canvas-comments';
import { exportElementsSchema, exportRowsSchema, needsBrowser } from '$lib/motion/export-rows';
import { ExportOutcome, exportSelection } from '$lib/server/motion/selection-export';
import { selectionPorts } from '$lib/server/motion/selection-export-ports';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { saveCanvasVersion } from '$lib/server/canvas/canvas-versions';
import { actAt, previewAt } from '$lib/server/canvas/history-actions';
import { HistoryAction } from '$lib/canvas/history/timeline';
import { Side } from '$lib/motion/branch-merge';
import { ResolveOutcome, resolveConflict } from '$lib/server/canvas/conflicts';
import { Resolution } from '$lib/server/repos/canvas-conflicts';
import { canvasPath } from '$lib/server/tenancy/entry';
import { FeegaImport, exportCanvasFile, importStoredCanvasFile, signCanvasFileUpload, storeCanvasFile } from '$lib/server/canvas/feega-file';
import { FEEGA_MAX_BYTES, FEEGA_REFUSAL_MESSAGE } from '$lib/canvas/feega-file';
import { createFormats, formatTargetSchema } from '$lib/server/motion/create-formats';
import { combineScenes, MAX_SCENES } from '$lib/server/motion/combine-scenes';
import { insertTemplate } from '$lib/server/canvas/templates';
import { runTechnique, saveFromSelection, TechniqueRun } from '$lib/server/canvas/techniques';
import { cancelRows, detachInstance, openDefinition, placeInstance, previewRows, rowsProgress, runInstance, runRows } from '$lib/server/canvas/technique-instance';
import { BATCH_MAX_ROWS } from '$lib/canvas/technique-batch';
import { deleteTechnique, listTechniques, TechniqueOutcome } from '$lib/server/repos/techniques';
import { writeNodesBatch } from '$lib/server/canvas/batch-write';
import { pasteNodes } from '$lib/server/canvas/paste';
import { figmaFramesOf, importFigmaInto } from '$lib/server/figma/canvas-import';
import { MAX_FRAMES } from '$lib/server/figma/import-file';
import { importUrlInto } from '$lib/server/url-import/canvas-import';
import { sectioningOf } from '$lib/server/url-import/url-doc';
import { importCodeInto } from '$lib/server/code-import/canvas-import';
import { canvasSnapshot } from '$lib/server/canvas/snapshot';
import { canvasRevision } from '$lib/server/canvas/revision';
import { readSelection, SELECTION_WAIT_MS } from '$lib/server/canvas/selection-read';
import { listMemberships } from '$lib/server/repos/orgs';
import { undoGesture } from '$lib/server/canvas/undo';
import { arrangeNodes } from '$lib/server/canvas/arrange';
import { STACK_GAP, alignTiles, distributeTiles, stackTiles, tidyTiles, type TileBox, type TileMove } from '$lib/canvas/align';
import { Axis, Edge } from '$lib/motion/space';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';
import { revertChange } from '$lib/server/canvas/revert';
import { Keep } from '$lib/canvas/reject-plan';
import { lastGesture } from '$lib/canvas/undo-last';
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
import { FORMATS, MOTION_FORMATS, MotionFormat } from '@feega/motion-core/motion/doc';
import { motionNodeSize } from '$lib/canvas/motion-node';
import { cancelRender } from '$lib/server/motion/render-run';
import { motionRenderFarm } from '$lib/server/motion/renderer';
import { withdrawFromGallery } from '$lib/server/gallery/publish';
import { importCanvasLink, registerCanvasUpload, UploadError } from '$lib/server/canvas/upload';
import { importFeedImage } from '$lib/server/canvas/feed-image';
import { DropOn } from '$lib/motion/move-element';
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
  agentKey?: string;
  sessionId?: string | null;
};

export type CanvasCtx = CanvasDeps & {
  actor: Actor;
  billed: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function canvasCtx(deps: CanvasDeps): CanvasCtx {
  const billed = <T>(fn: () => Promise<T>): Promise<T> =>
    deps.brandId ? withBrandContext(deps.brandId, fn) : withOrgContext(deps.orgId, fn);
  return { ...deps, actor: agentActor(deps.userId, deps.agentKey, deps.sessionId), billed };
}

const EXPORT_MAX_FRAMES = 50;

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

export function outcomeOf(out: GenerationOutcome): Record<string, unknown> {
  if (out.kind === 'variants') {
    return { outcome: 'variants', into: out.into, group: out.group, nodeIds: out.nodeIds, credits: out.credits, runs: out.runs.map(outcomeOf) };
  }
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
  BytesSenders = 'bytes_senders',
  Mcp = 'mcp'
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
const exportCodeFrameInput = z
  .object({
    nodeId: z.string().describe('A code frame (iframe with files) or a view of one.'),
    mode: z.enum(ExportMode).optional().describe('inline (default): every feega variable becomes its current value. config: values go to src/content.ts.')
  })
  .strict();

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
const placeComponentInput = z.object({ canvasId: z.string(), frameId: z.string().describe('the Frame node holding the main component'), compId: z.string().describe('the main component id'), x: z.number().finite(), y: z.number().finite() }).strict();
const placeInFrameInput =z.object({ nodeId: z.string().describe('the Generate image, Generate video or Generate text node'), ...frameTarget }).strict();

const drawElementInput = z
  .object({ canvasId: z.string(), drawn: drawnSchema.describe('{tool:text|rectangle|ellipse|polygon|star, box:{left,top,width,height}}, {tool:line|arrow, from:{x,y}, to:{x,y}, stroke?:#hex}, or {tool:pen, path:SVG d}, in canvas units') })
  .strict();

const figmaFramesInput = z.object({ url: z.string().describe('a figma.com design link') }).strict();
const importFigmaInput = z
  .object({
    canvasId: z.string(),
    url: z.string().describe('a figma.com design link; its node-id picks the frame when frameIds is left out'),
    frameIds: z.array(z.string()).min(1).max(MAX_FRAMES).optional().describe('frame ids from list_figma_frames'),
    x: z.number().finite(),
    y: z.number().finite()
  })
  .strict();

const importCodeInput = z.object({ canvasId: z.string(), repo: z.string().max(300).describe('a public https://github.com/<owner>/<repo> link, optionally /tree/<ref>'), route: z.string().max(300).optional().describe('the page of the app to import, default /'), x: z.number().finite(), y: z.number().finite() }).strict();

const importUrlInput = z
  .object({ canvasId: z.string(), url: z.string().max(2000).describe('a public http(s) web page'), x: z.number().finite(), y: z.number().finite(), sections: z.boolean().default(true).describe('split the page into named section frames (Nav, Hero, Features, Footer…); false keeps one layer tree') })
  .strict();

const drawFrameInput = z
  .object({
    canvasId: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive(),
    h: z.number().positive().optional(),
    format: z.enum(MOTION_FORMATS).optional(),
    still: z.number().min(0).optional().describe('seconds into the frame to keep, making it a still graphic (post, poster) instead of a video')
  })
  .strict()
  .refine((a) => a.h !== undefined || (a.format && a.format !== MotionFormat.Custom), 'h or a preset');

function frameBox(input: z.infer<typeof drawFrameInput>) {
  const preset = input.format && input.format !== MotionFormat.Custom ? FORMATS[input.format] : null;
  const height = preset ? (input.w * preset.height) / preset.width : (input.h as number);
  return { left: input.x, top: input.y, width: input.w, height };
}

const LOTTIE_MAX_BYTES = 8_000_000;
const LOTTIE_FETCH_TIMEOUT_MS = 15_000;

const importLottieInput = z
  .object({
    canvasId: z.string(),
    x: z.number().finite().describe('canvas position of the frame centre'),
    y: z.number().finite(),
    lottie: z.record(z.string(), z.unknown()).optional().describe('the Lottie JSON itself'),
    url: z.string().url().startsWith('https://').optional().describe('an https URL of a .json or .lottie file')
  })
  .strict()
  .refine((a) => Boolean(a.lottie) !== Boolean(a.url), 'give lottie or url, not both');

async function lottieOf(input: z.infer<typeof importLottieInput>): Promise<unknown> {
  if (input.lottie) {
    return input.lottie;
  }
  try {
    const fetched = await safeFetchBytes(input.url as string, { maxBytes: LOTTIE_MAX_BYTES, timeoutMs: LOTTIE_FETCH_TIMEOUT_MS, scheme: 'https-only' });
    return fetched.ok ? lottieSource(fetched.bytes) : 'The file could not be downloaded.';
  } catch (e) {
    return e instanceof SafeFetchError ? e.message : 'The file could not be downloaded.';
  }
}

const MOTION_TYPE = 'motion';

const createdSize = (type: string, data: Record<string, unknown>) => {
  if (type !== MOTION_TYPE) {
    return {};
  }
  const size = motionNodeSize(MOTION_FORMATS.find((f) => f === data.format) ?? MotionFormat.Vertical);
  return { width: size.w, height: size.h };
};

const groupElementsInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(1).max(50).describe('free elements on the canvas (element nodes), at least 2; or any nodes with section true'), section: z.boolean().optional().describe('wrap the nodes in a Section instead of a Group') }).strict();
const stackElementsInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(1).max(50).describe('free elements on the canvas (element nodes), at least 1') }).strict();
const ungroupElementInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a free element holding several shapes') }).strict();

const rotateGroupInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a Group on the canvas'), degrees: z.number().finite().describe('clockwise, added to its current angle') }).strict();
const scaleGroupInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a Group on the canvas'), width: z.number().positive(), height: z.number().positive() }).strict();
const moveGroupInput = z.object({ canvasId: z.string(), nodeId: z.string().describe('a Group on the canvas'), x: z.number().finite(), y: z.number().finite() }).strict();
const membersOf = (ctx: CanvasCtx, canvasId: string) => nodeMembers(ctx.db, { orgId: ctx.orgId, canvasId, actor: ctx.actor });

const figmaScope = (ctx: CanvasCtx) => ({ db: ctx.db, orgId: ctx.orgId, userId: ctx.userId, projectId: ctx.projectId, actor: ctx.actor });

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
    variants: z.number().int().optional().describe('1, 2, 4 or 8 results; omit for one.'),
    into: z.enum(['nodes', 'history']).optional().describe('With variants: new nodes (default) or this node\'s history.'),
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
const renameNodeInput = z.object({ nodeId: z.string(), name: z.string() }).strict();
const setNodeColorInput = z.object({ nodeId: z.string(), color: z.enum(COLOUR_TAGS).nullable().describe('null removes the tag') }).strict();
const resizeNodeInput = z.object({ nodeId: z.string(), width: z.number().positive(), height: z.number().positive() }).strict();
const nodeIdsInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(1) }).strict();
const duplicateInput = nodeIdsInput
  .extend({ offset: z.object({ dx: z.number(), dy: z.number() }).optional().describe('where the copies land relative to the originals; omitted = a small step') })
  .strict();
const shareCanvasInput = z.object({ canvasId: z.string(), on: z.boolean().describe('true mints a view-only link; false revokes it') }).strict();
const shareDocInput = z.object({ nodeId: z.string().describe('a doc node'), on: z.boolean() }).strict();
const insertTemplateInput = z.object({ canvasId: z.string(), templateId: z.string().describe('from list_templates'), x: z.number(), y: z.number() }).strict();
const saveTechniqueInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(2), name: z.string().describe('kebab-case, at most 48 characters') }).strict();
const runTechniqueInput = z
  .object({
    canvasId: z.string(),
    techniqueId: z.string().describe('from list_techniques'),
    x: z.number(),
    y: z.number(),
    inputs: z.array(z.object({ node: z.number().int(), value: z.string().max(4000) }).strict()).optional().describe('one value per input slot of the technique: the prompt of that node'),
    run: z.boolean().optional().describe('default true: run the inner graph (spends credits); false only places it')
  })
  .strict();
const techniqueRowsInput = z
  .object({
    techniqueId: z.string(),
    rows: z.array(z.array(z.string().max(4000))).min(1).max(BATCH_MAX_ROWS).describe('one array of cells per row'),
    mapping: z.array(z.number().int().nullable()).optional().describe('per input slot of the technique, the cell index it takes (null = none); default: slots take the cells in order. Image slots take a URL')
  })
  .strict();
const cancelRowsInput = z.object({ workflowIds: z.array(z.string()).min(1).max(BATCH_MAX_ROWS) }).strict();
const rowsProgressInput = z.object({ runIds: z.array(z.string()).min(1) }).strict();
const techniqueIdInput = z.object({ techniqueId: z.string() }).strict();
const placeTechniqueInput = z.object({ canvasId: z.string(), techniqueId: z.string(), x: z.number(), y: z.number() }).strict();
const techniqueNodeInput = z.object({ nodeId: z.string() }).strict();
const detachTechniqueInput = z.object({ canvasId: z.string(), nodeId: z.string() }).strict();
const addFrameInput = z
  .object({
    canvasId: z.string(),
    templateId: z.string().describe('a motion template id (list_motion_templates)'),
    format: z.enum(MOTION_FORMATS).default(MotionFormat.Landscape),
    values: z.record(z.string(), z.string().max(4000)).optional().describe('field key → value, as set_template_values takes them'),
    x: z.number(),
    y: z.number()
  })
  .strict();
const compareRunsInput = z.object({ nodeId: z.string(), runA: z.string().describe('from list_runs'), runB: z.string().describe('from list_runs') }).strict();
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
const arrangeInput = z.object({ canvasId: z.string(), nodeIds: z.array(z.string()).min(2) }).strict();
const alignNodesInput = arrangeInput.extend({ edge: z.enum(Object.values(Edge) as [Edge, ...Edge[]]).describe('left|center|right align x, top|middle|bottom align y, to the bounds of the selection') }).strict();
const distributeNodesInput = arrangeInput.extend({ axis: z.enum(Object.values(Axis) as [Axis, ...Axis[]]).describe('x spreads left to right, y top to bottom; equal gaps, the outer nodes stay') }).strict();
const stackNodesInput = arrangeInput.extend({ gap: z.number().min(0).default(STACK_GAP).describe('space between nodes in canvas units') }).strict();
const undoLastInput = z.object({ canvasId: z.string() }).strict();
const UNDO_LOOKBACK = 50;
const revertChangeInput = z
  .object({
    canvasId: z.string(),
    entryId: z.string().min(1).describe('an entry id (event:<n>) or a session key from list_history'),
    choices: z.array(z.object({ path: z.string(), keep: z.enum(Keep), eventId: z.number().int().optional() })).optional().describe('one per conflict: keep mine (the value there now), or reject (the value before the change)'),
    confirm: z.boolean().optional().describe('delete a created node even though someone else connected or edited it')
  })
  .strict();
const NOTHING_TO_UNDO = { outcome: 'nothing_to_undo' };
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
const importLinkInput = z.object({ url: z.string().url().describe('https link to a picture or video') }).strict();

const importFeedImageInput = z
  .object({
    canvasId: z.string(),
    nodeId: z.string().describe('the Social feed or Products node'),
    itemId: z.string().describe('id of a post (socialPosts) or product (products) in canvas_snapshot'),
    imageIndex: z.number().int().min(0).default(0).describe('which picture of a carousel post or product'),
    x: z.number().default(0).describe('canvas position of the new image node, its centre'),
    y: z.number().default(0),
    toFrameId: z.string().optional().describe('put the picture inside this Frame instead of making a node'),
    frameX: z.number().min(0).max(1).default(0.5),
    frameY: z.number().min(0).max(1).default(0.5)
  })
  .strict();

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

const historyPoint = z.object({ canvasId: z.string(), entryId: z.string().describe('an entry id from list_history, e.g. "version:<id>" or "revision:<frameId>:<n>"') }).strict();

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

async function arranged(ctx: CanvasCtx, input: { canvasId: string; nodeIds: string[] }, plan: (tiles: TileBox[]) => TileMove[]) {
  if (!(await inProject(ctx, input.canvasId))) {
    return NOT_IN_PROJECT;
  }
  return arrangeNodes(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, nodeIds: input.nodeIds, actor: ctx.actor, plan });
}

export const CANVAS_OPS = {
  list_canvases: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) => ({ canvases: await listCanvases(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }) })
  }),

  list_project_components: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) => ({ canvases: await listProjectComponents(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }) })
  }),

  export_code_frame: op({
    access: Access.Read,
    input: exportCodeFrameInput,
    run: async (ctx, input) => {
      const out = await exportCodeNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId, mode: input.mode ?? ExportMode.Inline });
      return out.ok ? { framework: out.framework, mode: out.mode, folder: out.folder, files: out.files } : { outcome: 'invalid', message: out.error };
    }
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

  get_selection: op({
    access: Access.Read,
    input: canvasIdInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const { channelFeed } = await import('$lib/server/canvas/selection-feed');
      return readSelection(channelFeed, { canvasId: input.canvasId, userId: ctx.userId, waitMs: SELECTION_WAIT_MS });
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
      const badVars = codeVarsError(input.type, input.data ?? {});
      if (badVars) {
        return { outcome: 'invalid', message: badVars };
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
        ...createdSize(input.type, verdict.data),
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

  set_node_color: op({
    access: Access.Write,
    input: setNodeColorInput,
    run: async (ctx, input) => {
      const written = await patchNodeData(ctx.db, {
        orgId: ctx.orgId,
        nodeId: input.nodeId,
        patch: withColour(input.color),
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

  align_nodes: op({
    access: Access.Write,
    input: alignNodesInput,
    run: async (ctx, input) => arranged(ctx, input, (tiles) => alignTiles(tiles, input.edge))
  }),

  distribute_nodes: op({
    access: Access.Write,
    input: distributeNodesInput.extend({ nodeIds: z.array(z.string()).min(3) }).strict(),
    run: async (ctx, input) => arranged(ctx, input, (tiles) => distributeTiles(tiles, input.axis))
  }),

  tidy_nodes: op({
    access: Access.Write,
    input: arrangeInput,
    run: async (ctx, input) => arranged(ctx, input, tidyTiles)
  }),

  stack_nodes: op({
    access: Access.Write,
    input: stackNodesInput,
    run: async (ctx, input) => arranged(ctx, input, (tiles) => stackTiles(tiles, input.gap))
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

  undo_last: op({
    access: Access.Write,
    input: undoLastInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const events = await listCanvasEvents(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, limit: UNDO_LOOKBACK });
      const gesture = lastGesture(events, ctx.actor);
      if (!gesture) {
        return NOTHING_TO_UNDO;
      }
      const result = await undoGesture(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, gesture, actor: ctx.actor });
      return result.outcome === 'refused' ? { outcome: 'refused', reason: result.reason } : { outcome: 'undone', reverted: gesture.items.map((item) => item.kind) };
    }
  }),

  revert_change: op({
    access: Access.Write,
    input: revertChangeInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      return revertChange(ctx.db, { orgId: ctx.orgId, ...input, actor: ctx.actor });
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
      return { connection };
    }
  }),

  create_formats: op({
    access: Access.Write,
    input: z.object({ frameId: z.string(), targets: z.array(formatTargetSchema).min(1).max(8).describe('each {format: 1:1 | 4:5 | 9:16 | 16:9 …} or {size: {width, height}} px') }).strict(),
    run: async (ctx, input) => createFormats(framesOf(ctx), { nodeId: input.frameId, targets: input.targets })
  }),

  combine_scenes: op({
    access: Access.Write,
    input: z.object({ frameIds: z.array(z.string().uuid()).min(2).max(MAX_SCENES).describe('scene frames; they play left to right as placed on the canvas') }).strict(),
    run: async (ctx, input) => combineScenes(framesOf(ctx), { frameIds: input.frameIds })
  }),

  export_selection: op({
    access: Access.Read,
    input: z
      .object({
        frameIds: z.array(z.string()).max(EXPORT_MAX_FRAMES).default([]),
        elements: exportElementsSchema.default([]),
        rows: exportRowsSchema.describe('value: 0.5–4 for scale, px for width/height'),
        name: z.string().max(60).optional()
      })
      .strict()
      .refine((i) => i.frameIds.length + i.elements.length > 0),
    run: async (ctx, input) => {
      if (needsBrowser(input.rows) && !serverFramesOpen()) {
        return { error: 'renderer_unavailable', message: 'image export needs the server renderer, which is not available here' };
      }
      const targets = [...input.frameIds.map((nodeId) => ({ nodeId })), ...input.elements.map((e) => ({ nodeId: e.frameId, elementId: e.elementId }))];
      const out = await exportSelection(selectionPorts({ db: ctx.db, orgId: ctx.orgId, projectId: ctx.projectId, brandId: ctx.brandId ?? null, actor: ctx.actor }), { targets, rows: input.rows, name: input.name ?? 'Export' });
      return out.outcome === ExportOutcome.Done ? out : { error: out.outcome, nodeId: out.nodeId, elementId: out.elementId };
    }
  }),

  styles: op({
    access: Access.Write,
    input: canvasStyleInput,
    run: async (ctx, input) => {
      const frames = framesOf(ctx);
      return canvasStyle(
        {
          ids: async () => (await listNodes(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId })).filter((n) => n.type === MOTION_TYPE).map((n) => n.id),
          read: frames.read,
          write: frames.write
        },
        input
      );
    }
  }),

  variables: op({
    access: Access.Write,
    input: canvasVariableInput,
    run: async (ctx, input) => {
      const frames = framesOf(ctx);
      return canvasVariable(
        {
          ids: async () => (await listNodes(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId })).filter((n) => n.type === MOTION_TYPE).map((n) => n.id),
          read: frames.read,
          write: frames.write
        },
        input
      );
    }
  }),

  move_frame_element: op({
    access: Access.Write,
    input: moveFrameElementInput,
    run: async (ctx, input) => frameAnswer(await moveElement(framesOf(ctx), { sourceNodeId: input.frameId, clipId: input.elementId, drop: dropFor(input) }))
  }),

  copy_frame_element: op({
    access: Access.Write,
    input: moveFrameElementInput,
    run: async (ctx, input) => frameAnswer(await copyElement(framesOf(ctx), { sourceNodeId: input.frameId, clipId: input.elementId, drop: dropFor(input) }))
  }),

  place_component: op({
    access: Access.Write,
    input: placeComponentInput,
    run: async (ctx, input) => frameAnswer(await placeComponent(framesOf(ctx), { sourceNodeId: input.frameId, compId: input.compId, canvasId: input.canvasId, drop: { on: DropOn.Canvas, x: input.x, y: input.y } }))
  }),

  draw_element: op({
    access: Access.Write,
    input: drawElementInput,
    run: async (ctx, input) => frameAnswer(await drawElement(framesOf(ctx), { projectId: ctx.projectId, canvasId: input.canvasId }, input.drawn))
  }),

  list_figma_frames: op({
    access: Access.Read,
    input: figmaFramesInput,
    run: async (ctx, input) => figmaFramesOf(figmaScope(ctx), input.url)
  }),

  import_figma: op({
    access: Access.Write,
    input: importFigmaInput,
    run: async (ctx, input) => importFigmaInto(figmaScope(ctx), input.canvasId, { url: input.url, nodeIds: input.frameIds ?? null, at: { x: input.x, y: input.y } })
  }),

  import_url: op({
    access: Access.Write,
    input: importUrlInput,
    run: async (ctx, input) => importUrlInto(figmaScope(ctx), input.canvasId, { url: input.url, at: { x: input.x, y: input.y }, sectioning: sectioningOf(input.sections) })
  }),

  import_code: op({
    access: Access.Write,
    input: importCodeInput,
    run: async (ctx, input) => importCodeInto(figmaScope(ctx), input.canvasId, { repo: input.repo, route: input.route, at: { x: input.x, y: input.y } })
  }),

  draw_frame: op({
    access: Access.Write,
    input: drawFrameInput,
    run: async (ctx, input) => frameAnswer(await drawFrameAt(framesOf(ctx), { projectId: ctx.projectId, canvasId: input.canvasId }, frameBox(input), input.format, input.still))
  }),

  import_lottie: op({
    access: Access.Write,
    input: importLottieInput,
    run: async (ctx, input) => {
      const json = await lottieOf(input);
      if (typeof json === 'string') {
        return { outcome: MoveOutcome.Invalid, message: json };
      }
      const placed = await importLottieAt(framesOf(ctx), { projectId: ctx.projectId, canvasId: input.canvasId }, json, { x: input.x, y: input.y }, () => crypto.randomUUID().slice(0, 8));
      if ('error' in placed) {
        return { outcome: MoveOutcome.Invalid, message: placed.error };
      }
      return { outcome: placed.outcome, frame_id: placed.frameId, skipped: placed.skipped };
    }
  }),

  group_elements: op({
    access: Access.Write,
    input: groupElementsInput,
    run: async (ctx, input) => {
      if (input.section) {
        const create = async ({ x, y, width, height, ...rest }: { id?: string; x: number; y: number; width: number; height: number; data: Record<string, unknown> }) =>
          createNode(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, type: 'section', x, y, width, height, ...rest, actor: ctx.actor });
        return frameAnswer(await wrapInSection({ members: membersOf(ctx, input.canvasId), create }, input.nodeIds));
      }
      return frameAnswer(await groupElements(framesOf(ctx), membersOf(ctx, input.canvasId), { projectId: ctx.projectId, canvasId: input.canvasId }, input.nodeIds));
    }
  }),

  stack_elements: op({
    access: Access.Write,
    input: stackElementsInput,
    run: async (ctx, input) => frameAnswer(await stackElements(framesOf(ctx), { projectId: ctx.projectId, canvasId: input.canvasId }, input.nodeIds))
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

  scale_group: op({
    access: Access.Write,
    input: scaleGroupInput,
    run: async (ctx, input) => frameAnswer(await scaleNodeGroup(membersOf(ctx, input.canvasId), input.nodeId, { w: input.width, h: input.height }))
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

      const asked = parseVariantsAsk({ variants: input.variants, into: input.into });
      if (!asked.ok) {
        return { outcome: 'refused', error: asked.error };
      }

      const data = node.data as { prompt?: string; model?: string; params?: GenParams };
      const out = await ctx.billed(() =>
        runGeneration(ctx.db, {
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
          actor: ctx.actor,
          count: asked.count,
          into: asked.into
        })
      );

      return outcomeOf(out);
    }
  }),

  image_tool: op({
    access: Access.Spend,
    input: imageToolAskSchema,
    run: async (ctx, input) => {
      const started = await ctx.billed(() =>
        startImageTool(ctx.db, IMAGE_TOOL_DEPS, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, sourceNodeId: input.nodeId, tool: input.tool, factor: input.factor, prompt: input.prompt, mask: input.mask, extend: input.extend, aspect: input.aspect, actor: ctx.actor })
      );
      if (!started.ok) {
        return { error: started.error };
      }
      return { nodeId: started.nodeId, ...outcomeOf(started.outcome) };
    }
  }),

  video_reframe: op({
    access: Access.Write,
    input: videoReframeAskSchema,
    run: async (ctx, input) => {
      const started = await startVideoReframe(ctx.db, VIDEO_REFRAME_DEPS, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, sourceNodeId: input.nodeId, aspect: input.aspect, focus: input.focus, actor: ctx.actor });
      return started.ok ? { outcome: 'done', nodeId: started.nodeId } : { error: started.error };
    }
  }),

  layers_to_frame: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => {
      const made = await layersToFrame(ctx.db, layersToFrameDeps(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, actor: ctx.actor }), { orgId: ctx.orgId, nodeId: input.nodeId });
      return made.ok ? { outcome: 'done', frameId: made.frameId } : { error: made.error };
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

  compare_runs: op({
    access: Access.Read,
    input: compareRunsInput,
    run: async (ctx, input) => {
      const runs = await runsOf(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      const a = runs.find((r) => r.id === input.runA);
      const b = runs.find((r) => r.id === input.runB);
      if (!a || !b) {
        return { error: 'run_not_found', message: 'Both runs must belong to the node (list_runs).' };
      }

      const side = (r: typeof a) => ({ runId: r.id, assetId: r.outputAssetId, prompt: r.prompt, model: r.model, params: r.params, costUsd: r.costUsd, startedAt: r.startedAt });
      return { a: side(a), b: side(b), diff: diffRuns(a, b) };
    }
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
    run: async (ctx, input) => cancelBatch(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId })
  }),

  cancel_run: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => cancelNodeRun(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId, actor: ctx.actor })
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

  rename_node: op({
    access: Access.Write,
    input: renameNodeInput,
    run: async (ctx, input) => {
      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      await renameOnCanvas(ctx.db, { orgId: ctx.orgId, canvasId: node.canvasId, ...input });
      return { renamed: true };
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
    input: duplicateInput,
    run: async (ctx, input) => duplicateNodes(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, ...input, actor: ctx.actor })
  }),

  save_canvas_version: op({
    access: Access.Write,
    input: z.object({ canvasId: z.string(), name: z.string().max(60).describe('e.g. "Client review"') }).strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? saveCanvasVersion(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, name: input.name, actor: ctx.actor }) : NOT_IN_PROJECT)
  }),

  resolve_conflict: op({
    access: Access.Write,
    input: z.object({ canvasId: z.string(), conflictId: z.string().describe('the id after `conflict:` in list_history'), keep: z.enum(Resolution) }).strict(),
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const out = await resolveConflict(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, conflictId: input.conflictId, resolution: input.keep, actor: ctx.actor });
      return out.outcome === ResolveOutcome.Resolved ? { resolved: true, keep: input.keep } : { error: out.outcome, ...(out.error ? { message: out.error } : {}) };
    }
  }),

  export_canvas_file: op({
    access: Access.Read,
    audience: Audience.BytesSenders,
    input: z.object({ canvasId: z.string() }).strict(),
    run: async (ctx, input) => {
      const scope = { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId };
      const file = (await inProject(ctx, input.canvasId)) ? await exportCanvasFile(ctx.db, scope) : null;
      return file ? { name: file.name, bytes: file.bytes.byteLength, url: await storeCanvasFile(ctx.db, scope, file) } : NOT_IN_PROJECT;
    }
  }),

  request_canvas_import: op({
    access: Access.Write,
    audience: Audience.BytesSenders,
    input: z.object({ bytes: z.number().int().positive().max(FEEGA_MAX_BYTES) }).strict(),
    run: async (ctx) => ({ ...(await signCanvasFileUpload(ctx.db, ctx.orgId)), then: 'PUT the file to uploadUrl, then import_canvas_file with this path.' })
  }),

  import_canvas_file: op({
    access: Access.Write,
    audience: Audience.BytesSenders,
    input: z.object({ path: z.string().describe('from request_canvas_import') }).strict(),
    run: async (ctx, input) => {
      const out = await importStoredCanvasFile(ctx.db, { orgId: ctx.orgId, projectFor: async () => ctx.projectId, path: input.path, actor: ctx.actor });
      return out.outcome === FeegaImport.Imported ? { canvas: out.canvas, path: canvasPath(ctx.projectId, out.canvas.id) } : { error: out.refusal, message: FEEGA_REFUSAL_MESSAGE[out.refusal] };
    }
  }),

  preview_at: op({
    access: Access.Read,
    input: historyPoint,
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? previewAt(ctx.db, { orgId: ctx.orgId, ...input }) : NOT_IN_PROJECT)
  }),

  restore_to: op({
    access: Access.Write,
    input: historyPoint,
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? actAt(ctx.db, { orgId: ctx.orgId, ...input, action: HistoryAction.Restore, actor: ctx.actor }) : NOT_IN_PROJECT)
  }),

  merge_branch_at: op({
    access: Access.Write,
    input: historyPoint.extend({ keep: z.enum(Side).optional().describe('which side wins every conflict; without it a conflict is answered, not merged') }),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? actAt(ctx.db, { orgId: ctx.orgId, ...input, action: HistoryAction.Merge, actor: ctx.actor }) : NOT_IN_PROJECT)
  }),

  drop_branch_at: op({
    access: Access.Write,
    input: historyPoint,
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? actAt(ctx.db, { orgId: ctx.orgId, ...input, action: HistoryAction.Drop, actor: ctx.actor }) : NOT_IN_PROJECT)
  }),

  name_version: op({
    access: Access.Write,
    input: historyPoint.extend({ name: z.string().max(200).describe('empty removes the name') }),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? actAt(ctx.db, { orgId: ctx.orgId, ...input, action: HistoryAction.Name, actor: ctx.actor }) : NOT_IN_PROJECT)
  }),

  list_canvas_comments: op({
    access: Access.Read,
    input: z.object({ canvasId: z.string() }).strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? { threads: await listComments(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId }), teammates: await teammates(ctx.db, ctx.orgId) } : NOT_IN_PROJECT)
  }),

  add_canvas_comment: op({
    access: Access.Write,
    input: z
      .object({
        canvasId: z.string(),
        body: z.string().max(2000),
        nodeId: z.string().optional().describe('pin to this node; x/y are then relative to its top-left'),
        parentId: z.string().optional().describe('reply to this thread (a comment id from list_canvas_comments)'),
        x: z.number().optional(),
        y: z.number().optional(),
        timeMs: z.number().int().min(0).optional().describe('the moment of a motion frame the comment is about, in milliseconds'),
        mentions: z.array(z.string()).optional().describe('teammate ids from list_canvas_comments; write @Name in the body too')
      })
      .strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? addComment(ctx.db, { orgId: ctx.orgId, actor: ctx.actor, ...input }) : NOT_IN_PROJECT)
  }),

  edit_canvas_comment: op({
    access: Access.Write,
    input: z.object({ canvasId: z.string(), commentId: z.string(), body: z.string().max(2000), mentions: z.array(z.string()).optional() }).strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? { outcome: await editComment(ctx.db, { orgId: ctx.orgId, actor: ctx.actor, ...input }) } : NOT_IN_PROJECT)
  }),

  delete_canvas_comment: op({
    access: Access.Write,
    input: z.object({ canvasId: z.string(), commentId: z.string() }).strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? { outcome: await deleteComment(ctx.db, { orgId: ctx.orgId, actor: ctx.actor, ...input }) } : NOT_IN_PROJECT)
  }),

  resolve_canvas_comment: op({
    access: Access.Write,
    input: z.object({ canvasId: z.string(), commentId: z.string().describe('the first comment of the thread'), resolved: z.boolean() }).strict(),
    run: async (ctx, input) => ((await inProject(ctx, input.canvasId)) ? { outcome: await resolveThread(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, commentId: input.commentId, resolved: input.resolved }) } : NOT_IN_PROJECT)
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

  list_techniques: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) => {
      const techniques = await listTechniques(ctx.db, ctx.orgId);
      return { techniques: (techniques ?? []).map((t) => ({ id: t.id, name: t.name, nodes: t.plan.nodes.length, version: t.version, inputs: t.inputs, outputs: t.outputs })), available: techniques !== null };
    }
  }),

  save_technique: op({
    access: Access.Write,
    input: saveTechniqueInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const saved = await saveFromSelection(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId, nodeIds: input.nodeIds, name: input.name, actor: ctx.actor });
      return saved.outcome === 'saved' ? { outcome: 'saved', techniqueId: saved.technique.id, name: saved.technique.name, inputs: saved.technique.inputs, outputs: saved.technique.outputs } : saved;
    }
  }),

  run_technique: op({
    access: Access.Spend,
    input: runTechniqueInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const then = input.run === false ? TechniqueRun.Place : TechniqueRun.Run;
      const ask = { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, userId: ctx.userId, techniqueId: input.techniqueId, at: { x: input.x, y: input.y }, inputs: input.inputs ?? [], then, actor: ctx.actor };
      return then === TechniqueRun.Run ? ctx.billed(() => runTechnique(ctx.db, ask)) : runTechnique(ctx.db, ask);
    }
  }),

  preview_technique_rows: op({
    access: Access.Read,
    input: techniqueRowsInput,
    run: async (ctx, input) => previewRows(ctx.db, { orgId: ctx.orgId, techniqueId: input.techniqueId, rowCount: input.rows.length })
  }),

  run_technique_rows: op({
    access: Access.Spend,
    input: techniqueRowsInput,
    run: async (ctx, input) =>
      ctx.billed(() => runRows(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, techniqueId: input.techniqueId, rows: input.rows, mapping: input.mapping ?? null, actor: ctx.actor }))
  }),

  technique_rows_progress: op({
    access: Access.Read,
    input: rowsProgressInput,
    run: async (ctx, input) => rowsProgress(ctx.db, { runIds: input.runIds })
  }),

  cancel_technique_rows: op({
    access: Access.Write,
    input: cancelRowsInput,
    run: async (ctx, input) => cancelRows(ctx.db, { orgId: ctx.orgId, workflowIds: input.workflowIds })
  }),

  place_technique: op({
    access: Access.Write,
    input: placeTechniqueInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      return placeInstance(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, userId: ctx.userId, techniqueId: input.techniqueId, at: { x: input.x, y: input.y }, actor: ctx.actor });
    }
  }),

  run_technique_node: op({
    access: Access.Spend,
    input: techniqueNodeInput,
    run: async (ctx, input) => ctx.billed(() => runInstance(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, userId: ctx.userId, nodeId: input.nodeId, actor: ctx.actor }))
  }),

  detach_technique: op({
    access: Access.Write,
    input: detachTechniqueInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      return detachInstance(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, nodeId: input.nodeId, actor: ctx.actor });
    }
  }),

  open_technique: op({
    access: Access.Write,
    input: techniqueIdInput,
    run: async (ctx, input) => openDefinition(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, techniqueId: input.techniqueId, actor: ctx.actor })
  }),

  delete_technique: op({
    access: Access.Write,
    input: techniqueIdInput,
    run: async (ctx, input) => {
      const outcome = await deleteTechnique(ctx.db, ctx.orgId, input.techniqueId);
      return outcome === TechniqueOutcome.Ok ? { deleted: true } : { error: outcome };
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
        values: input.values,
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

  import_link: op({
    access: Access.Write,
    input: importLinkInput,
    run: async (ctx, input) => uploadAnswer(async () => ({ asset: (await importCanvasLink(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId, url: input.url })).asset }))
  }),

  import_feed_image: op({
    access: Access.Write,
    input: importFeedImageInput,
    run: async (ctx, input) => {
      if (!(await inProject(ctx, input.canvasId))) {
        return NOT_IN_PROJECT;
      }
      const drop = input.toFrameId ? { on: DropOn.Frame, nodeId: input.toFrameId, at: { x: input.frameX, y: input.frameY } } as const : { on: DropOn.Canvas, x: input.x, y: input.y } as const;
      return uploadAnswer(async () => {
        const landed = await importFeedImage({ db: ctx.db, frames: framesOf(ctx), actor: ctx.actor }, { orgId: ctx.orgId, projectId: ctx.projectId, canvasId: input.canvasId, nodeId: input.nodeId, itemId: input.itemId, imageIndex: input.imageIndex, drop });
        return landed.placed === 'frame' ? frameAnswer(landed.moved) : { node: landed.node, asset: landed.asset };
      });
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
