import { cardPreviews } from '$lib/server/canvas/card-previews';
import { rendererSwitch } from '$lib/server/canvas-renderer-switch';
import { z } from 'zod';
import { chatHandoff } from '$lib/server/canvas/chat-handoff';
import { MEDIA_UUID_RE } from '$lib/media-url';
import { importCanvasLink, registerCanvasUpload, registerUploadedAsset, UploadError } from '$lib/server/canvas/upload';
import { saveFontUpload } from '$lib/server/motion/font-upload';
import { isOutputHandle } from '$lib/canvas/select-outputs';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoadEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import type { Canvas } from '$lib/server/repos/canvas';
import {
  createConnection,
  createNode,
  deleteConnection,
  findNode,
  listConnections,
  listNodes,
  moveNode,
  setConnectionMode,
  patchNodeData,
  DataCheck,
  type PatchWrite
} from '$lib/server/repos/canvas';
import { nodeSize } from '$lib/canvas/node-size';
import { isNodeType, influencerOf } from '$lib/canvas-node-data';
import { validateNodeData } from '$lib/canvas/node-data';
import type { Actor } from '$lib/server/repos/actor';
import { isCanvasEdgeKind, isWireMode } from '$lib/canvas-edges';
import { projectCatalogue } from '$lib/server/project-catalogue';
import { Capability, MODE_REFUSAL, modeAllows, modeOf, type ProjectMode } from '$lib/project-mode';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { MIN_VOICE_DESCRIPTION, VOICE_REFUSAL_MESSAGE, type VoiceRefusal } from '$lib/canvas/voices';
import type { VoiceDeps } from '$lib/server/voices/custom-voices';

const HTTP_UNAVAILABLE = 503;
const MAX_VOICE_NAME = 100;
const VOICE_FAIL_STATUS: Partial<Record<VoiceRefusal | 'voice_not_found', number>> = {
  voice_slots_full: 409,
  voice_not_found: 404,
  voice_not_yours: 403,
  cloning_not_in_this_project: 403
};
import { runGenNode, runsOf } from '$lib/server/canvas/generate';
import { planLoop, enqueueLoop, cancelLoop, retryLoopCombo } from '$lib/server/canvas/loop';
import { planWorkflowDryRun, enqueueWorkflow, cancelWorkflow, workflowCredits } from '$lib/server/canvas/workflow';
import { GraphScope, enqueueGraph, planGraph, type GraphInput } from '$lib/server/canvas/run-graph';
import { duplicateNodes } from '$lib/server/canvas/duplicate';
import { offsetFrom } from '$lib/canvas/duplicate-plan';
import { ShowRun, removeNodes, resizeOnCanvas, shareDoc, showRun, type RunShown } from '$lib/server/canvas/node-writes';
import { syncNode } from '$lib/server/canvas/node-sync';
import { insertTemplate } from '$lib/server/canvas/templates';
import { templateLibrary } from '$lib/server/motion/templates';
import { canvasOutlines } from '$lib/server/motion/frame-outlines';
import { FROM_TEMPLATE_DEPS, FromTemplate, startFromTemplate } from '$lib/server/motion/from-template';
import { serverTiming } from '$lib/server/server-timing';
import { MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import { endOnboarding, firstRunFor, runDemo } from '$lib/server/onboarding/first-run';
import { OnboardingStatus } from '$lib/onboarding/coach';
import { undoGesture } from '$lib/server/canvas/undo';
import { writeNodesBatch, type BatchItem } from '$lib/server/canvas/batch-write';
import { pasteNodes, type PastedEdge, type PastedNode } from '$lib/server/canvas/paste';
import { parseUndoItem, type Gesture, type UndoItem } from '$lib/canvas/undo-plan';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { canvasSnapshot, loadDownloaded, loadGenRuns } from '$lib/server/canvas/snapshot';
import { listSourcesForNodes } from '$lib/server/repos/posts';
import { nextStepsFor, nodeTextCost } from '$lib/server/canvas/node-hints';
import { applyEffectsNode } from '$lib/server/canvas/apply-effects';
import { makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { nodeAcceptsConnection } from '$lib/canvas/connector-ports';
import { connectVerdict } from '$lib/server/canvas/node-model';
import { ShareState, readCanvasShare, setCanvasShare } from '$lib/server/canvas/canvas-share';
import { referenceLibrary } from '$lib/server/canvas/reference-library';
import { CanvasRemoval, openNewCanvas, removeCanvas, renameCanvasTo } from '$lib/server/canvas/lifecycle';
import { canvasPath } from '$lib/server/tenancy/entry';
import { renameProject } from '$lib/server/repos/projects';
import { canvasRevision, recordsRevision } from '$lib/server/canvas/revision';
import { restackAskSchema, restackNodes } from '$lib/server/canvas/restack-nodes';
import { groupAskSchema, groupElements, moveNodeGroup, rotateNodeGroup, scaleNodeGroup, ungroupElement } from '$lib/server/motion/element-groups';
import { nodeMembers } from '$lib/server/motion/node-members';
import { SIZE_STATUS, SizeOutcome, sizeAskSchema, sizeFrame } from '$lib/server/motion/frame-size';
import { FORMATS_STATUS, FormatsOutcome, createFormats, formatsAskSchema } from '$lib/server/motion/create-formats';
import { exportElementsSchema, exportRowsSchema } from '$lib/motion/export-rows';
import { ExportOutcome, exportSelection } from '$lib/server/motion/selection-export';
import { selectionPorts } from '$lib/server/motion/selection-export-ports';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { FreeSource, MOVE_STATUS, MoveOutcome, canvasBoxSchema, copyElement, drawElement, drawFrameAt, drawnSchema, freeAskSchema, frameStore, moveFree, canvasFrameInputs, moveAskSchema, moveElement, outputAskSchema, placeOutput, type Moved } from '$lib/server/motion/move-element';

// L'azione `run` aspetta la generazione DENTRO la richiesta — un'immagine ci mette fino a un
// minuto, e il default della piattaforma è sotto quella soglia. Senza, la richiesta muore a metà
// e il giro resta `running` senza che nessuno lo chiuda: lo stesso valore che porta ogni altra
// rotta che genera un'immagine (`api/v1/brands/[slug]/media/images`).
export const config = { maxDuration: 300 };

/**
 * LA TELA, DAL LATO DEL SERVER.
 *
 * Una `load` e delle action, e niente fra le due: il componente non parla col database, e queste
 * action sono l'unica porta. Ognuna rifà da sé la domanda «questa tela è sua?» — passare l'org
 * dal client sarebbe farsi dire dal browser dentro quale tenant scrivere.
 *
 * `version` VIAGGIA CON IL CONTENUTO e non con la posizione: il repository tratta le due cose in
 * modo diverso di proposito — trascinare è last-write-wins, scrivere un prompt no — e qui si
 * rispetta quella divisione invece di uniformarla.
 */
type CanvasParams = { projectId: string; canvasId: string };

type Scope = { db: Db; orgId: string; canvasId: string; canvas: Canvas; userId: string; accountCreatedAt: string; mode: ProjectMode; projectBrandId: string | null };

/** Ogni gesto della tela che passa da qui è di una persona, mai un `system` muto: `canvas_events` deve saperlo. */
function userActor(scope: { userId: string }): Actor {
  return { kind: 'user', id: scope.userId };
}

function jsonField(fd: FormData, key: string): unknown {
  const raw = fd.get(key);
  if (typeof raw !== 'string' || !raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function canvasFrames(scope: Scope) {
  return frameStore(scope.db, { orgId: scope.orgId, actor: userActor(scope), projectId: scope.canvas.projectId });
}

function canvasMembers(scope: Scope) {
  return nodeMembers(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, actor: userActor(scope) });
}

function movedAnswer(moved: Moved) {
  return moved.outcome === MoveOutcome.Done ? moved : fail(MOVE_STATUS[moved.outcome], { error: moved.outcome, detail: moved.detail });
}

async function scopeFor(locals: App.Locals, canvasId: string): Promise<Scope> {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findCanvasForUser(db, { canvasId, memberships });
  if (!found) {
    throw error(404, 'questa tela non esiste, o non è tua');
  }

  const mode = modeOf(found.mode);
  if (!(await canvasReachable(db, { orgId: found.orgId, mode }, user.id))) {
    throw error(404, 'questa tela non esiste, o non è tua');
  }

  return { db, orgId: found.orgId, canvasId, canvas: found.canvas, userId: user.id, accountCreatedAt: user.created_at, mode, projectBrandId: found.projectBrandId };
}

async function scopeAllowing(locals: App.Locals, canvasId: string, capability: Capability): Promise<Scope> {
  const scope = await scopeFor(locals, canvasId);
  if (!modeAllows(scope.mode, capability)) {
    throw error(403, MODE_REFUSAL[capability]);
  }
  return scope;
}

async function voiceDepsOf(scope: Scope) {
  const { configuredVoiceDeps } = await import('$lib/server/voices/voices-config');
  return configuredVoiceDeps(scope.db);
}

function voiceScopeOf(scope: Scope) {
  return { orgId: scope.orgId, userId: scope.userId, actor: userActor(scope) };
}

function voiceFail(error: VoiceRefusal | 'voice_not_found') {
  const message = error === 'voice_not_found' ? 'This voice does not exist.' : VOICE_REFUSAL_MESSAGE[error];
  return fail(VOICE_FAIL_STATUS[error] ?? 400, { error, message });
}

async function spendOnVoice<T>(
  scope: Scope,
  work: (deps: VoiceDeps, useCases: typeof import('$lib/server/voices/custom-voices')) => Promise<T>
) {
  const deps = await voiceDepsOf(scope);
  if (!deps) {
    return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
  }
  const denied = await gateOrgAiActionForForm(scope.orgId);
  if (denied) {
    return fail(denied.status, denied.data);
  }
  return work(deps, await import('$lib/server/voices/custom-voices'));
}

export const load = async ({ params, locals, url }: ServerLoadEvent<CanvasParams>) => {
  const { db, orgId, canvasId, canvas, mode, projectBrandId, userId, accountCreatedAt } = await scopeFor(locals, params.canvasId);

  const [nodes, listed, catalogue, shareToken, references, orgTemplates, handoff, killSwitch, previews] = await Promise.all([
    listNodes(db, { orgId, canvasId }),
    listConnections(db, { orgId, canvasId }),
    projectCatalogue(db, { orgId, mode }),
    readCanvasShare(db, { orgId, canvasId }),
    referenceLibrary(db, { orgId, projectId: canvas.projectId }),
    templateLibrary(db, { orgId, actor: userActor({ userId }) }).own(),
    chatHandoff(db, { orgId, projectId: canvas.projectId }, url),
    rendererSwitch(),
    cardPreviews(db, { orgId, projectId: canvas.projectId }).catch(() => ({}))
  ]);

  const connections = await canvasFrameInputs(db, { orgId, actor: userActor({ userId }), projectId: canvas.projectId }, nodes, listed);

  const [runs, { products, socialPosts, influencers }, sources, onboarding, outlines] = await Promise.all([
    loadGenRuns(db, { orgId, nodes }),
    loadDownloaded(db, { orgId, canvasId, nodes }),
    listSourcesForNodes(db, nodes.map((node) => node.id)),
    firstRunFor(db, { userId, orgId, accountCreatedAt, nodeCount: nodes.length }),
    canvasOutlines(db, { orgId, nodes })
  ]);

  const nodeIdsInPost = [...new Set(sources.map((source) => source.nodeId))];

  return {
    rendererSwitch: killSwitch,
    handoff,
    canvas,
    nodes,
    connections,
    revision: recordsRevision(nodes, connections),
    catalogue,
    runs,
    products,
    socialPosts,
    influencers,
    projectId: params.projectId,
    orgId,
    nodeIdsInPost,
    shareToken,
    references,
    mode,
    projectBrandId,
    onboarding,
    orgTemplates,
    outlines,
    cardPreviews: previews
  };
};

function jsonObject(value: FormDataEntryValue | null): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const HTTP_BAD_REQUEST = 400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;


const PATCH_ANSWERS: { [K in PatchWrite['outcome']]: (written: Extract<PatchWrite, { outcome: K }>) => unknown } = {
  written: (written) => ({ node: written.node }),
  conflict: (written) => fail(HTTP_CONFLICT, { conflict: true, keys: written.keys }),
  invalid: (written) => fail(HTTP_BAD_REQUEST, { error: written.error }),
  gone: () => fail(HTTP_NOT_FOUND, { error: 'node not found' })
};

/** Un numero che arriva da un form: finito, o la riga nasce con `NaN` dentro una colonna numerica. */
function coord(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const SHOW_RUN_ANSWERS: { [K in ShowRun]: (shown: Extract<RunShown, { outcome: K }>) => unknown } = {
  [ShowRun.Shown]: (shown) => ({ node: shown.node }),
  [ShowRun.NodeMissing]: () => fail(HTTP_NOT_FOUND, { error: 'node not found' }),
  [ShowRun.RunMissing]: () => fail(HTTP_NOT_FOUND, { error: 'generation not found' }),
  [ShowRun.Conflict]: () => fail(HTTP_CONFLICT, { conflict: true })
};

function isShareState(value: string): value is ShareState {
  return (Object.values(ShareState) as string[]).includes(value);
}

const GRAPH_SCOPES = new Set<string>(Object.values(GraphScope));

function graphInputOf(fd: FormData, scope: Scope): GraphInput | null {
  const graph = String(fd.get('graph') ?? '');
  if (!GRAPH_SCOPES.has(graph)) {
    return null;
  }
  const nodeIds = fd.getAll('node_ids').map(String).filter(Boolean);
  return {
    orgId: scope.orgId,
    canvasId: scope.canvasId,
    graph: graph as GraphScope,
    nodeId: String(fd.get('node_id') ?? '') || undefined,
    nodeIds: nodeIds.length ? nodeIds : undefined
  };
}

const valuesSchema = z.record(z.string(), z.string().max(4000));

function templateValues(raw: FormDataEntryValue | null): Record<string, string> | null {
  if (!raw) {
    return {};
  }
  try {
    const parsed = valuesSchema.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const actions: Actions<CanvasParams> = {
  new_canvas: async ({ params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const projectId = scope.canvas.projectId;
    const canvas = await openNewCanvas(scope.db, { orgId: scope.orgId, projectId });
    throw redirect(303, canvasPath(projectId, canvas.id));
  },

  rename_canvas: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const name = String((await request.formData()).get('name') ?? '');
    const renamed = await renameCanvasTo(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, name });
    if (!renamed) {
      return fail(400, { error: 'name required' });
    }
    return { renamed: true };
  },

  delete_canvas: async ({ params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const projectId = scope.canvas.projectId;
    const result = await removeCanvas(scope.db, { orgId: scope.orgId, projectId, canvasId: scope.canvasId });
    if (result.outcome === CanvasRemoval.LastCanvas) {
      return fail(HTTP_CONFLICT, { error: 'last canvas' });
    }
    throw redirect(303, canvasPath(projectId, result.nextCanvasId));
  },

  rename_project: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const name = String((await request.formData()).get('name') ?? '').trim();
    if (!name) {
      return fail(400, { error: 'name required' });
    }

    const { data } = await scope.db
      .from('projects')
      .select('id')
      .eq('id', scope.canvas.projectId)
      .eq('org_id', scope.orgId)
      .is('archived_at', null)
      .maybeSingle();
    if (!data) {
      throw error(404, 'questo progetto non esiste, o non è tuo');
    }

    await renameProject(scope.db, { orgId: scope.orgId, projectId: scope.canvas.projectId, name });
    return { renamed: true };
  },

  audio_voices: async ({ params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const [{ configuredAudioProvider }, { cachedVoices }, { configuredVoiceDeps }, { voiceSlots }] = await Promise.all([
      import('$lib/server/elevenlabs-config'),
      import('$lib/server/canvas/audio-voices'),
      import('$lib/server/voices/voices-config'),
      import('$lib/server/voices/custom-voices')
    ]);
    const provider = configuredAudioProvider();
    const deps = configuredVoiceDeps(scope.db);
    if (!provider || !deps) {
      return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
    }
    const [voices, custom, slots] = await Promise.all([cachedVoices(provider), deps.store.list(scope.orgId), voiceSlots(deps, scope.orgId)]);
    return { voices, custom, slots };
  },

  voice_library: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const deps = await voiceDepsOf(scope);
    if (!deps) {
      return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
    }
    const { libraryFiltersOf } = await import('$lib/server/voices/voice-forms');
    return deps.provider.library(libraryFiltersOf(await request.formData()));
  },

  voice_use_library: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const input = {
      ownerId: String(fd.get('owner_id') ?? ''),
      voiceId: String(fd.get('voice_id') ?? ''),
      name: String(fd.get('name') ?? '').trim().slice(0, MAX_VOICE_NAME)
    };
    if (!input.ownerId || !input.voiceId || !input.name) {
      return fail(400, { error: 'voice_not_found', message: 'This voice does not exist.' });
    }
    const deps = await voiceDepsOf(scope);
    if (!deps) {
      return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
    }
    return { voiceId: await deps.provider.addShared(input), name: input.name };
  },

  voice_design: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const description = String((await request.formData()).get('description') ?? '').trim();
    if (description.length < MIN_VOICE_DESCRIPTION) {
      return fail(400, { error: 'description_too_short', message: `Describe the voice in at least ${MIN_VOICE_DESCRIPTION} characters.` });
    }
    return spendOnVoice(scope, async (deps, { designPreviews }) => {
      const out = await designPreviews(deps, voiceScopeOf(scope), { description });
      return out.ok ? { previews: out.previews } : voiceFail(out.error);
    });
  },

  voice_save: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const input = {
      generatedVoiceId: String(fd.get('generated_voice_id') ?? ''),
      name: String(fd.get('name') ?? '').trim().slice(0, MAX_VOICE_NAME),
      description: String(fd.get('description') ?? '').trim()
    };
    if (!input.generatedVoiceId || !input.name) {
      return fail(400, { error: 'name_required', message: 'Give the voice a name.' });
    }
    const deps = await voiceDepsOf(scope);
    if (!deps) {
      return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
    }
    const { saveDesignedVoice } = await import('$lib/server/voices/custom-voices');
    const out = await saveDesignedVoice(deps, voiceScopeOf(scope), input);
    return out.ok ? { voice: out.voice } : voiceFail(out.error);
  },

  voice_clone: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const { cloneFormOf } = await import('$lib/server/voices/voice-forms');
    const form = await cloneFormOf(await request.formData());
    if ('error' in form) {
      return fail(400, { error: form.error, message: 'Record your voice and give it a name.' });
    }
    return spendOnVoice(scope, async (deps, { cloneVoice }) => {
      const out = await cloneVoice(deps, voiceScopeOf(scope), { ...form, mode: scope.mode });
      return out.ok ? { voice: out.voice } : voiceFail(out.error);
    });
  },

  voice_delete: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const id = String((await request.formData()).get('id') ?? '');
    const deps = await voiceDepsOf(scope);
    if (!deps) {
      return fail(HTTP_UNAVAILABLE, { error: 'elevenlabs_not_configured' });
    }
    const { deleteVoice } = await import('$lib/server/voices/custom-voices');
    const out = await deleteVoice(deps, scope.orgId, id);
    return out.ok ? { deleted: true } : voiceFail(out.error);
  },

  estimate_text_cost: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const nodeId = String(fd.get('node_id') ?? '');
    const userPrompt = String(fd.get('prompt') ?? '');
    const model = String(fd.get('model') ?? '') || null;
    if (!nodeId) {
      return fail(400, { error: 'node not found' });
    }

    return nodeTextCost(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeId, prompt: userPrompt, model });
  },

  upload: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const path = String(fd.get('path') ?? '');
    const fileName = String(fd.get('file_name') ?? '');
    const mimeType = String(fd.get('mime_type') ?? '');
    const bytes = coord(fd.get('bytes'));
    if (!path || !fileName || !mimeType || bytes === null) {
      return fail(400, { error: 'invalid request' });
    }

    try {
      if (fd.get('into') === 'library') {
        const { asset } = await registerUploadedAsset(scope.db, {
          orgId: scope.orgId, projectId: scope.canvas.projectId, path, fileName, mimeType, bytes
        });
        return { asset };
      }

      return await registerCanvasUpload(scope.db, {
        orgId: scope.orgId, projectId: scope.canvas.projectId, canvasId: scope.canvasId,
        path, fileName, mimeType, bytes,
        x: coord(fd.get('x')) ?? 0, y: coord(fd.get('y')) ?? 0
      });
    } catch (cause) {
      if (cause instanceof UploadError) { return fail(cause.status, { error: cause.message }); }
      throw cause;
    }
  },
  uploadFont: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const saved = await saveFontUpload(scope.db, { orgId: scope.orgId, path: String((await request.formData()).get('path') ?? '') });
    return saved.ok ? { font: saved.font } : fail(400, { error: saved.error });
  },
  importLink: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const url = String((await request.formData()).get('url') ?? '');
    if (!url) {
      return fail(400, { error: 'invalid request' });
    }

    try {
      const { asset } = await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.canvas.projectId, url });
      return { asset };
    } catch (cause) {
      if (cause instanceof UploadError) { return fail(cause.status, { error: cause.message }); }
      throw cause;
    }
  },
  snapshot: async ({ params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    return canvasSnapshot(scope.db, scope);
  },

  revision: async ({ params, locals }) => {
    const { session, user } = await locals.safeGetSession();
    const db = await locals.db();
    if (!session || !user || !db) {
      throw redirect(303, '/login');
    }
    const memberships = await listMemberships(db, user.id);
    return canvasRevision(db, { canvasId: params.canvasId, projectId: params.projectId, memberships });
  },

  run: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const medium = String(fd.get('medium') ?? '');
    const prompt = String(fd.get('prompt') ?? '');
    const model = String(fd.get('model') ?? '') || null;
    const version = Number(fd.get('version'));
    if (!nodeId || !isNodeType(medium) || !Number.isInteger(version)) {
      return fail(400, { error: 'invalid request' });
    }

    let paramsIn: Record<string, unknown> = {};
    try {
      paramsIn = JSON.parse(String(fd.get('params') ?? '{}')) as Record<string, unknown>;
    } catch {
      return fail(400, { error: 'unreadable parameters' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const out = await runGenNode(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodeId,
      userId: scope.userId,
      medium: medium as never,
      prompt,
      model,
      params: paramsIn as never,
      expectedVersion: version
    });

    if (out.kind === 'refused') { return fail(400, { error: out.error }); }
    if (out.kind === 'conflict') { return fail(409, { conflict: true }); }
    return out;
  },

  /**
   * IL PREVENTIVO DEL LOOP: quante combinazioni, quanti crediti — MAI un gate crediti, un
   * preventivo non spende (CLAUDE.md: il nodo mostra il costo prima del clic).
   */
  loop_plan: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    if (!nodeId) {
      return fail(400, { error: 'invalid request' });
    }

    try {
      return await planLoop(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeId });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'loop_plan_failed';
      return fail(message === 'node_not_found' ? 404 : 400, { error: message });
    }
  },

  /**
   * IL LOOP: METTE IN CODA, non gira — vedi `loop.ts` per il perché. Sopra 50 combinazioni serve
   * `confirm=1` esplicito nel form, sopra 1000 si rifiuta comunque. Il cron
   * (`canvas/runs/tick`, ogni minuto) drena la coda nei minuti successivi: questa azione torna
   * quando i biglietti sono scritti, non quando le immagini esistono.
   */
  run_loop: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    if (!nodeId) {
      return fail(400, { error: 'invalid request' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const out = await enqueueLoop(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodeId,
      userId: scope.userId,
      confirmed: fd.get('confirm') === '1'
    });

    if (out.kind === 'refused') { return fail(400, { error: out.error }); }
    return out;
  },

  /**
   * CANCELLA IL LOOP: ferma solo i biglietti non ancora reclamati da un tick — quelli già in
   * corso finiscono, e i risultati già completati restano nella lista di output.
   */
  cancel_loop: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    if (!nodeId) {
      return fail(400, { error: 'invalid request' });
    }

    return await cancelLoop(scope.db, { orgId: scope.orgId, nodeId });
  },

  /**
   * RITENTA UN ITEM FALLITO DI UN OUTPUT DI LOOP — subito, non in coda: `loop.ts::retryLoopCombination`.
   * L'item porta solo `label`/`run_id`; i valori dell'iterazione (`params.loop.values`) vivono sul
   * biglietto originale in `node_runs`, e sono quelli che questa azione rilegge invece di
   * indovinarli dall'item — un item che perde il proprio `run_id` (mai dovrebbe accadere dopo
   * `createOutputList`) cade sul confronto per `label`, l'unica altra chiave che un item porta.
   */
  retry_loop_combo: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const outputListNodeId = String(fd.get('output_list_node_id') ?? '');
    const label = String(fd.get('label') ?? '');
    const runId = fd.get('run_id');
    if (!nodeId || !outputListNodeId) {
      return fail(400, { error: 'invalid request' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    return retryLoopCombo(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodeId,
      userId: scope.userId,
      outputListNodeId,
      label,
      runId: typeof runId === 'string' && runId ? runId : null
    });
  },

  /**
   * IL PREVENTIVO DEL WORKFLOW: pianifica senza scrivere niente, per la conferma prima del clic —
   * la stessa forma di `loop_plan`.
   */
  workflow_plan: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeIds = fd.getAll('node_id').map(String).filter(Boolean);
    if (nodeIds.length < 2) {
      return fail(400, { error: 'invalid request' });
    }

    const plan = await planWorkflowDryRun(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeIds });
    if (!plan.ok) {
      return fail(400, { error: plan.reason });
    }

    return { steps: plan.steps, estimatedCredits: await workflowCredits(scope.db, { orgId: scope.orgId, nodeIds }) };
  },

  /**
   * IL WORKFLOW: METTE IN CODA, non gira — vedi `workflow.ts` per il perché, la stessa dottrina
   * del loop. Torna quando i biglietti sono scritti, il cron (`canvas/runs/tick`) li drena nei
   * minuti successivi rispettando le dipendenze fra passi.
   */
  run_workflow: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeIds = fd.getAll('node_id').map(String).filter(Boolean);
    if (nodeIds.length < 2) {
      return fail(400, { error: 'invalid request' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const out = await enqueueWorkflow(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodeIds,
      userId: scope.userId
    });

    if (out.kind === 'refused') {
      return fail(400, { error: out.error });
    }

    return { workflowId: out.workflowId, steps: out.steps, estimatedCredits: await workflowCredits(scope.db, { orgId: scope.orgId, nodeIds }) };
  },

  graph_plan: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const graph = graphInputOf(await request.formData(), scope);
    if (!graph) {
      return fail(400, { error: 'richiesta non valida' });
    }

    const { plan, credits } = await planGraph(scope.db, graph);
    return plan.ok ? { steps: plan.steps, credits } : fail(400, { error: plan.reason });
  },

  run_graph: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const graph = graphInputOf(await request.formData(), scope);
    if (!graph) {
      return fail(400, { error: 'richiesta non valida' });
    }

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, denied.data);
    }

    const out = await enqueueGraph(scope.db, { ...graph, projectId: scope.canvas.projectId, userId: scope.userId });
    return out.kind === 'enqueued' ? { workflowId: out.workflowId, steps: out.steps, credits: out.credits } : fail(400, { error: out.error });
  },

  /**
   * CANCELLA IL WORKFLOW: ferma solo i biglietti non ancora reclamati — la stessa dottrina di
   * `cancel_loop`.
   */
  cancel_workflow: async ({ request, locals, params }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const workflowId = String(fd.get('workflow_id') ?? '');
    if (!workflowId) {
      return fail(400, { error: 'invalid request' });
    }

    return await cancelWorkflow(scope.db, { orgId: scope.orgId, workflowId });
  },

  /**
   * SINCRONIZZARE UN NODO `products` O `social_account_feed`. Non è `run`: non c'è un provider
   * asincrono da rincorrere, il giro finisce dentro questa stessa richiesta — quindi lo stato si
   * scrive due volte, "sta scaricando" prima di chiamare il fetcher e il risultato dopo, invece
   * di aprire una `node_runs` per un giro che non ha bisogno di sopravvivere alla richiesta.
   *
   * `projectId` PASSA AL REPO ANCHE QUANDO NULLO: `products`/`social_posts` sono indipendenti da
   * un brand, ma restano del progetto che le ha scaricate — un `project_id` nullo è una riga che
   * la libreria del progetto non trova più.
   */
  sync: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const version = coord(fd.get('version'));
    if (!nodeId || version === null || !Number.isInteger(version) || version < 1) {
      return fail(400, { error: 'invalid request' });
    }

    const written = await syncNode(scope.db, { orgId: scope.orgId, projectId: scope.canvas.projectId, nodeId, version, actor: userActor(scope) });
    if (written.outcome === 'not_syncable') {
      return fail(404, { error: 'node not found' });
    }
    return (PATCH_ANSWERS[written.outcome] as (w: PatchWrite) => unknown)(written);
  },

  /**
   * RIMETTERE IN VETRINA UN GIRI DI PRIMA. La storia non si tocca: è uno sguardo, non una
   * cancellazione — e il `refId` che resta è l'unica cosa che sopravvive a una ricarica.
   */
  restore: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const runId = String(fd.get('run_id') ?? '');
    if (!nodeId || !runId) {
      return fail(400, { error: 'invalid request' });
    }

    const shown = await showRun(scope.db, { orgId: scope.orgId, nodeId, runId, actor: userActor(scope) });
    return SHOW_RUN_ANSWERS[shown.outcome](shown as never);
  },

  create: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const type = String(fd.get('type') ?? '');
    const x = coord(fd.get('x'));
    const y = coord(fd.get('y'));
    if (!isNodeType(type) || x === null || y === null) {
      return fail(400, { error: 'invalid node' });
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(String(fd.get('data') ?? '{}')) as Record<string, unknown>;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return fail(400, { error: 'invalid content' });
      }
    } catch {
      return fail(400, { error: 'unreadable content' });
    }

    // Un nodo trascinato dalla libreria degli asset o dai brand arriva con `data` già scritto
    // dal browser (`CanvasFlow::onCreateFilled`): non meno un input esterno di un form, e il
    // CHECK del database (`nodes_data_shape_check`) è l'ultima riga di difesa, non la prima —
    // rifiutarlo qui dà un errore leggibile invece di un 500 dal vincolo.
    const verdict = validateNodeData(type, data);
    if (!verdict.ok) {
      return fail(400, { error: verdict.error });
    }

    const node = await createNode(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      type,
      x,
      y,
      data: verdict.data,
      actor: userActor(scope)
    });

    return { node };
  },

  /**
   * UNA SCRITTURA PER GESTO, non per fotogramma: il client chiama qui quando il trascinamento
   * finisce. Il repository è last-write-wins apposta — due mani sullo stesso nodo si contendono
   * il puntatore, e nessuna delle due perde lavoro scritto.
   */
  move: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const x = coord(fd.get('x'));
    const y = coord(fd.get('y'));
    if (!nodeId || x === null || y === null) {
      return fail(400, { error: 'invalid move' });
    }

    if (!(await listNodes(scope.db, scope)).some((node) => node.id === nodeId)) {
      return fail(404, { error: 'node not found' });
    }

    const node = await moveNode(scope.db, { orgId: scope.orgId, nodeId, x, y, actor: userActor(scope) });
    if (!node) {
      return fail(404, { error: 'node not found' });
    }

    return { moved: true };
  },

  /**
   * RIDIMENSIONARE: STESSA DOTTRINA DI `move` — last-write-wins, nessun `canvas_events` (il
   * commento in cima a `canvas.ts` lo dice esplicitamente), una scrittura sola a fine gesto, non
   * per fotogramma. Il minimo non è un numero a caso qui: è quello del TIPO del nodo
   * (`nodeSize`), lo stesso che decide la misura di un nodo appena creato — un nodo non può
   * restringersi sotto la taglia in cui nasce.
   */
  resize: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const width = coord(fd.get('width'));
    const height = coord(fd.get('height'));
    if (!nodeId || width === null || height === null) {
      return fail(400, { error: 'invalid resize' });
    }

    if (!(await resizeOnCanvas(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeId, width, height }))) {
      return fail(404, { error: 'node not found' });
    }
    return { resized: true };
  },

  /**
   * IL CONTENUTO PASSA DALLA VERSIONE, e zero righe è un conflitto e non un successo: chi chiama
   * lo sente come `conflict` e rilegge, invece di credere di aver scritto sopra qualcuno.
   */
  write: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const patch = jsonObject(fd.get('patch'));
    const base = jsonObject(fd.get('base'));
    if (!nodeId || !patch || !base) {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid write' });
    }

    if (!(await listNodes(scope.db, scope)).some((node) => node.id === nodeId)) {
      return PATCH_ANSWERS.gone({ outcome: 'gone' });
    }

    const written = await patchNodeData(scope.db, {
      orgId: scope.orgId,
      nodeId,
      patch,
      base,
      check: DataCheck.Schema,
      actor: userActor(scope)
    });

    return (PATCH_ANSWERS[written.outcome] as (w: PatchWrite) => unknown)(written);
  },

  apply_effects: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const nodeId = String(fd.get('node_id') ?? '');
    if (!nodeId) {
      return fail(400, { error: 'missing node' });
    }

    const outcome = await applyEffectsNode(scope.db, {
      orgId: scope.orgId,
      nodeId,
      actor: userActor(scope)
    });
    if (outcome.outcome === 'refused') {
      return fail(400, { error: outcome.error });
    }
    if (outcome.outcome === 'conflict') {
      return fail(409, { conflict: true });
    }

    const node = await findNode(scope.db, { orgId: scope.orgId, nodeId });
    return { asset: outcome.asset, node };
  },

  effects_pair: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const nodeId = String(fd.get('node_id') ?? '');
    if (!nodeId) {
      return fail(400, { error: 'missing node' });
    }

    const outcome = await makeEffectsPair(scope.db, { orgId: scope.orgId, nodeId, actor: userActor(scope) });
    if (outcome.outcome === 'refused') {
      return fail(400, { error: outcome.error });
    }
    if (outcome.outcome === 'conflict') {
      return fail(409, { conflict: true });
    }

    const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: outcome.nodeId });
    const connection = (await listConnections(scope.db, { orgId: scope.orgId, canvasId: params.canvasId })).find((edge) => edge.targetNodeId === outcome.nodeId);
    return { node, connection };
  },

  /**
   * SCRIVERE LO STESSO CAMPO SU PIÙ NODI — la barra della selezione, quando cambia modello,
   * formato, durata, audio o ripetizione su uno o più nodi scelti. UN CONFLITTO SU UN NODO NON
   * FERMA GLI ALTRI: sono N scritture indipendenti (ognuna con la propria `version` attesa, come
   * `write`), e riportare "conflict" per il nodo 3 mentre 1 e 2 sono andati a buon fine è più
   * onesto di un rifiuto in blocco che butterebbe via due scritture riuscite per colpa di una
   * terza.
   */
  batchWrite: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    let items: BatchItem[];
    try {
      items = JSON.parse(String(fd.get('items') ?? '[]'));
      if (!Array.isArray(items) || !items.length) {
        return fail(400, { error: 'nothing to write' });
      }
    } catch {
      return fail(400, { error: 'unreadable content' });
    }

    const results = await writeNodesBatch(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, items, actor: userActor(scope) });
    return { results };
  },

  /**
   * IL LINK PUBBLICO DI UN DOCUMENTO. Il token in chiaro esce qui e non torna più: resta solo
   * l'impronta, e «Nuovo link» ne conia un altro revocando quello di prima.
   */
  share: async ({ request, params, locals }) => {
    const scope = await scopeAllowing(locals, params.canvasId, Capability.Share);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const on = fd.get('on') === 'true';
    if (!nodeId) {
      return fail(400, { error: 'invalid document' });
    }

    const shared = await shareDoc(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeId, on });
    return shared ?? fail(404, { error: 'document not found' });
  },

  share_canvas: async ({ request, params, locals }) => {
    const scope = await scopeAllowing(locals, params.canvasId, Capability.Share);
    const fd = await request.formData();

    const state = String(fd.get('state') ?? '');
    if (!isShareState(state)) {
      return fail(400, { error: 'invalid sharing state' });
    }

    const shareToken = await setCanvasShare(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, state });
    return { shareToken };
  },

  connect: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const sourceNodeId = String(fd.get('source_node_id') ?? '');
    const targetNodeId = String(fd.get('target_node_id') ?? '');
    const kind = String(fd.get('kind') ?? '');
    const targetHandle = fd.get('target_handle');
    const outputHandle = fd.get('source_handle');
    if (!sourceNodeId || !targetNodeId || !isCanvasEdgeKind(kind)) {
      return fail(400, { error: 'invalid connection' });
    }

    // Il verso viaggia sull'attacco: `nodes_connections` non ha una colonna `kind`, e perderlo
    // qui vorrebbe dire riaprire la tela con ogni linea tornata «nasce da».
    const canvasNodes = await listNodes(scope.db, scope);
    const nodeIds = new Set(canvasNodes.map((node) => node.id));
    if (sourceNodeId === targetNodeId || !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
      return fail(400, { error: 'invalid connection' });
    }

    const sourceNode = canvasNodes.find((node) => node.id === sourceNodeId);
    const targetNode = canvasNodes.find((node) => node.id === targetNodeId);
    const lines = await listConnections(scope.db, scope);
    const chosenId = String(fd.get('connection_id') ?? '');
    const replayed = lines.find((edge) => edge.id === chosenId);
    if (replayed) {
      return { connection: replayed, linked: null };
    }
    const existing = lines.map((edge) => ({
      id: edge.id,
      target: edge.targetNodeId,
      targetHandle: edge.targetHandle
    }));
    if (!nodeAcceptsConnection(existing, targetNodeId, targetNode?.type ?? '')) {
      return fail(400, { error: 'an effects node takes a single media' });
    }

    const refusal = connectVerdict(sourceNode ?? null, targetNode ?? null);
    if (refusal) {
      return fail(400, { error: refusal });
    }

    const connection = await createConnection(scope.db, {
      id: MEDIA_UUID_RE.test(chosenId) ? chosenId : undefined,
      orgId: scope.orgId,
      canvasId: scope.canvasId,
      sourceNodeId,
      targetNodeId,
      sourceHandle: isOutputHandle(outputHandle) ? outputHandle : kind,
      // La porta tipizzata (`ConnectorType`) su cui questo arco atterra — assente per la maggior
      // parte dei gesti (l'attacco generico d'origine), presente quando chi collega SA già quale
      // porta vuole: "Collega a nuovo…"/"Collega a…" sulla selezione (`connect-selection-plan.ts`).
      targetHandle: typeof targetHandle === 'string' && targetHandle ? targetHandle : null,
      actor: userActor(scope)
    });

    return { connection };
  },

  exportSelection: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const rows = exportRowsSchema.safeParse(jsonField(fd, 'rows'));
    const frameIds = jsonField(fd, 'frame_ids') ?? [];
    const elements = exportElementsSchema.safeParse(jsonField(fd, 'elements') ?? []);
    if (!rows.success || !elements.success || !Array.isArray(frameIds) || frameIds.length + elements.data.length === 0) {
      return fail(400, { error: 'invalid export' });
    }
    if (!serverFramesOpen()) {
      return fail(503, { error: 'image export needs the server renderer, which is not available here' });
    }
    const ports = selectionPorts({ db: scope.db, orgId: scope.orgId, projectId: scope.canvas.projectId, brandId: scope.projectBrandId, actor: userActor(scope) });
    const out = await exportSelection(ports, { targets: [...frameIds.map((id) => ({ nodeId: String(id) })), ...elements.data.map((e) => ({ nodeId: e.frameId, elementId: e.elementId }))], rows: rows.data, name: String(fd.get('name') || 'Export') }).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
    if (out instanceof Error) {
      return fail(502, { error: `the images could not be drawn: ${out.message}` });
    }
    return out.outcome === ExportOutcome.Done ? out : fail(404, { error: out.outcome });
  },

  createFormats: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = formatsAskSchema.safeParse({ nodeId: fd.get('node_id'), targets: jsonField(fd, 'targets') });
    if (!ask.success) {
      return fail(400, { error: 'invalid formats' });
    }
    const made = await createFormats(canvasFrames(scope), ask.data);
    return made.outcome === FormatsOutcome.Done ? made : fail(FORMATS_STATUS[made.outcome], { error: made.outcome, detail: made.detail });
  },

  frameSize: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = sizeAskSchema.safeParse({ nodeId: fd.get('node_id'), width: fd.get('width') ?? undefined, height: fd.get('height') ?? undefined });
    if (!ask.success) {
      return fail(400, { error: 'invalid frame size' });
    }
    const sized = await sizeFrame(canvasFrames(scope), ask.data);
    return sized.outcome === SizeOutcome.Done ? sized : fail(SIZE_STATUS[sized.outcome], { error: sized.outcome, detail: sized.detail });
  },

  moveElement: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = moveAskSchema.safeParse({ sourceNodeId: fd.get('source'), clipId: fd.get('clip'), drop: jsonField(fd, 'drop'), box: jsonField(fd, 'box'), versions: jsonField(fd, 'versions') });
    if (!ask.success) {
      return fail(400, { error: 'spostamento non valido' });
    }
    return movedAnswer(await moveElement(canvasFrames(scope), ask.data));
  },

  copyElement: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = moveAskSchema.safeParse({ sourceNodeId: fd.get('source'), clipId: fd.get('clip'), drop: jsonField(fd, 'drop') });
    if (!ask.success) {
      return fail(400, { error: 'invalid paste' });
    }
    return movedAnswer(await copyElement(canvasFrames(scope), ask.data));
  },

  moveFree: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = freeAskSchema.safeParse({ sourceNodeId: fd.get('source'), drop: jsonField(fd, 'drop') });
    if (!ask.success) {
      return fail(400, { error: 'invalid drop' });
    }
    return movedAnswer(await moveFree(canvasFrames(scope), ask.data));
  },

  copyFree: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = freeAskSchema.safeParse({ sourceNodeId: fd.get('source'), drop: jsonField(fd, 'drop') });
    if (!ask.success) {
      return fail(400, { error: 'invalid paste' });
    }
    return movedAnswer(await moveFree(canvasFrames(scope), ask.data, FreeSource.Keep));
  },

  groupElements: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const form = await request.formData();
    const ask = groupAskSchema.safeParse({ ids: jsonField(form, 'ids'), id: String(form.get('node_id') ?? '') || undefined });
    if (!ask.success) {
      return fail(400, { error: 'invalid group' });
    }
    return movedAnswer(await groupElements(canvasFrames(scope), canvasMembers(scope), { projectId: scope.canvas.projectId, canvasId: scope.canvasId }, ask.data.ids, ask.data.id));
  },

  restack: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = restackAskSchema.safeParse({ ids: jsonField(fd, 'ids'), to: fd.get('to') });
    if (!ask.success) {
      return fail(400, { error: 'invalid restack' });
    }
    return { restacked: await restackNodes(scope.db, scope, userActor(scope), ask.data.ids, ask.data.to) };
  },

  rotateGroup: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const degrees = Number(fd.get('degrees'));
    const id = String(fd.get('id') ?? '');
    if (!id || !Number.isFinite(degrees)) {
      return fail(400, { error: 'invalid rotation' });
    }
    return movedAnswer(await rotateNodeGroup(canvasFrames(scope), canvasMembers(scope), id, degrees));
  },

  scaleGroup: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const w = Number(fd.get('width'));
    const h = Number(fd.get('height'));
    if (!id || !(w > 0) || !(h > 0)) {
      return fail(400, { error: 'invalid size' });
    }
    return movedAnswer(await scaleNodeGroup(canvasMembers(scope), id, { w, h }));
  },

  moveGroup: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const x = coord(fd.get('x'));
    const y = coord(fd.get('y'));
    if (!id || x === null || y === null) {
      return fail(400, { error: 'invalid move' });
    }
    return movedAnswer(await moveNodeGroup(canvasMembers(scope), id, { x, y }));
  },

  ungroupElement: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const id = String((await request.formData()).get('id') ?? '');
    if (!id) {
      return fail(400, { error: 'invalid group' });
    }
    return movedAnswer(await ungroupElement(canvasFrames(scope), canvasMembers(scope), { projectId: scope.canvas.projectId, canvasId: scope.canvasId }, id));
  },

  drawElement: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const ask = drawnSchema.safeParse(jsonField(fd, 'drawn'));
    const id = String(fd.get('node_id') ?? '') || undefined;
    if (!ask.success || (id && !UUID.test(id))) {
      return fail(400, { error: 'invalid drawing' });
    }
    const drawn = await drawElement(canvasFrames(scope), { projectId: scope.canvas.projectId, canvasId: scope.canvasId, id }, ask.data);
    if (drawn.outcome !== MoveOutcome.Done) {
      return movedAnswer(drawn);
    }
    return { ...drawn, node: await findNode(scope.db, { orgId: scope.orgId, nodeId: drawn.frameId }) };
  },

  drawFrame: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();
    const box = canvasBoxSchema.safeParse(jsonField(fd, 'box'));
    const id = String(fd.get('node_id') ?? '') || undefined;
    if (!box.success || (id && !UUID.test(id))) {
      return fail(400, { error: 'invalid frame' });
    }
    const drawn = await drawFrameAt(canvasFrames(scope), { projectId: scope.canvas.projectId, canvasId: scope.canvasId, id }, box.data);
    return { ...drawn, node: await findNode(scope.db, { orgId: scope.orgId, nodeId: drawn.frameId }) };
  },

  placeOutput: async ({ request, params, locals, setHeaders }) => {
    const phases = serverTiming();
    const scope = await phases.time('scope', scopeFor(locals, params.canvasId));
    const fd = await request.formData();
    const ask = outputAskSchema.safeParse({ sourceNodeId: fd.get('source'), drop: jsonField(fd, 'drop'), id: fd.get('node_id') ?? undefined });
    if (!ask.success) {
      return fail(400, { error: 'rilascio non valido' });
    }
    const placed = await phases.time('place', placeOutput(phases.port(canvasFrames(scope)), ask.data));
    const node = placed.outcome === MoveOutcome.Done && placed.created ? await phases.time('read', findNode(scope.db, { orgId: scope.orgId, nodeId: placed.frameId })) : null;
    setHeaders({ 'server-timing': phases.header() });
    return placed.outcome === MoveOutcome.Done ? { ...placed, node } : movedAnswer(placed);
  },

  disconnect: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const connectionId = String(fd.get('connection_id') ?? '');
    if (!connectionId) {
      return fail(400, { error: 'invalid line' });
    }

    if (!(await listConnections(scope.db, scope)).some((edge) => edge.id === connectionId)) {
      return { disconnected: true };
    }
    await deleteConnection(scope.db, { orgId: scope.orgId, connectionId, actor: userActor(scope) });

    return { disconnected: true };
  },

  /**
   * FISSO O ITERATE — il toggle che rende un filo un asse di loop (`loop-axes.ts`), non una
   * connessione nuova: l'arco resta lo stesso, cambia solo come un nodo a valle lo legge.
   */
  set_edge_mode: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const connectionId = String(fd.get('connection_id') ?? '');
    const mode = String(fd.get('mode') ?? '');
    if (!connectionId || !isWireMode(mode)) {
      return fail(400, { error: 'invalid mode' });
    }

    const connection = await setConnectionMode(scope.db, { orgId: scope.orgId, connectionId, mode });
    if (!connection) {
      return fail(404, { error: 'line not found' });
    }

    return { connection };
  },

  /**
   * CANCELLARE È MORBIDO, e le linee cadono con i nodi: `nodes_connections` non ha un cascade su
   * un `deleted_at`, quindi una linea verso un nodo sparito resterebbe nel database e tornerebbe
   * disegnata alla prossima apertura, puntando al vuoto.
   */
  remove: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeIds = String(fd.get('node_ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!nodeIds.length) {
      return fail(400, { error: 'nothing to delete' });
    }

    if (!(await removeNodes(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeIds, actor: userActor(scope) }))) {
      return fail(404, { error: 'node not found' });
    }
    return { removed: true };
  },

  /**
   * ⌘D SULLA SELEZIONE, O ⌘V DI QUEL CHE ⌘C HA COPIATO: stessa scrittura, forme diverse di chi la
   * chiede — duplicare rilegge gli id dalla tela aperta, incollare porta già `type`/`data`/`x`/`y`
   * per ogni nodo (il client li ha letti dal proprio stato, magari da un'ALTRA tela della stessa
   * org) più le linee interne per indice. `duplicateNodes` fa la prima; questa azione fa anche la
   * seconda quando `nodes` arriva nel form — la stessa validazione di `create`, ripetuta per riga,
   * perché un payload che viaggia nella clipboard non è meno un input esterno di un form.
   */
  duplicate: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeIds = String(fd.get('node_ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!nodeIds.length) {
      return fail(400, { error: 'nothing to duplicate' });
    }

    const out = await duplicateNodes(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodeIds,
      offset: offsetFrom(fd.get('dx'), fd.get('dy')),
      actor: userActor(scope)
    });

    return out;
  },

  paste: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    let pasted: PastedNode[];
    let edges: PastedEdge[];
    try {
      pasted = JSON.parse(String(fd.get('nodes') ?? '[]'));
      edges = JSON.parse(String(fd.get('edges') ?? '[]'));
      if (!Array.isArray(pasted) || !Array.isArray(edges)) {
        return fail(400, { error: 'invalid content' });
      }
    } catch {
      return fail(400, { error: 'unreadable content' });
    }
    if (!pasted.length) {
      return fail(400, { error: 'nothing to paste' });
    }

    const out = await pasteNodes(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      nodes: pasted,
      edges,
      actor: userActor(scope)
    });
    return 'refused' in out ? fail(400, { error: out.refused }) : out;
  },

  demo_run: async ({ params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);

    const nodes = await runDemo(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, actor: userActor(scope) });
    if (!nodes) {
      return fail(HTTP_BAD_REQUEST, { error: 'chain_incomplete' });
    }
    return { nodes };
  },

  onboarding_end: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const to = String((await request.formData()).get('status') ?? '');
    if (to !== OnboardingStatus.Dismissed && to !== OnboardingStatus.Completed) {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid state' });
    }

    return { ended: await endOnboarding(scope.db, scope.userId, to) };
  },

  frame_template: async ({ request, params, locals, setHeaders }) => {
    const phases = serverTiming();
    const scope = await phases.time('scope', scopeFor(locals, params.canvasId));
    const fd = await request.formData();

    const at = { x: Number(fd.get('x')), y: Number(fd.get('y')) };
    const format = String(fd.get('format') ?? MotionFormat.Landscape) as MotionFormat;
    const id = String(fd.get('node_id') ?? '') || undefined;
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || !MOTION_FORMATS.includes(format) || (id && !UUID.test(id))) {
      return fail(400, { error: 'invalid frame' });
    }

    const values = templateValues(fd.get('values'));
    if (!values) {
      return fail(400, { error: 'invalid values' });
    }

    const actor = userActor(scope);
    const deps = { ...FROM_TEMPLATE_DEPS, listCanvases: async () => [scope.canvas] };
    const started = await phases.time('start', startFromTemplate(scope.db, deps, {
      id,
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      userId: scope.userId,
      templateId: String(fd.get('template') ?? ''),
      format,
      values,
      at,
      actor
    }));
    if (started.outcome !== FromTemplate.Started) {
      return fail(400, { error: started.outcome });
    }

    const node = started.node;
    setHeaders({ 'server-timing': phases.header() });
    return { node };
  },

  template: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const at = { x: Number(fd.get('x')), y: Number(fd.get('y')) };
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) {
      return fail(400, { error: 'invalid position' });
    }

    const out = await insertTemplate(scope.db, {
      orgId: scope.orgId,
      projectId: scope.canvas.projectId,
      canvasId: scope.canvasId,
      templateId: String(fd.get('template_id') ?? ''),
      at,
      actor: userActor(scope)
    });
    if (!out) {
      return fail(400, { error: 'unknown template' });
    }

    return out;
  },

  /**
   * ⌘Z: ANNULLA UN GESTO, non un item — vedi `undo-plan.ts::checkGesture`. Il client manda gli
   * `UndoItem` del suo stack (uno per il gesto più uno per ogni `edge.delete` che un cambio di
   * modello ha portato con sé), e questa azione li applica con GLI STESSI repo di ogni scrittura
   * ordinaria: la stessa concorrenza ottimistica, lo stesso soft-delete, la stessa riga in
   * `canvas_events` attribuita a chi ha premuto Ctrl+Z.
   *
   * UN RIFIUTO NON È UN 500: `409` con una `reason` leggibile — un collega ha cambiato lo stesso
   * nodo nel frattempo, o l'ha già cancellato, o ci ha agganciato un arco che questo undo
   * cancellerebbe senza saperlo. Mai una scrittura silenziosa sopra il lavoro di un altro.
   */
  undo: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    let raw: unknown[];
    try {
      raw = JSON.parse(String(fd.get('items') ?? '[]'));
      if (!Array.isArray(raw) || !raw.length) {
        return fail(400, { error: 'nothing to undo' });
      }
    } catch {
      return fail(400, { error: 'unreadable content' });
    }

    const items = raw.map(parseUndoItem);
    if (items.some((item) => item === null)) {
      return fail(400, { error: 'invalid gesture' });
    }

    const gesture: Gesture = { items: items as UndoItem[] };
    const result = await undoGesture(scope.db, {
      orgId: scope.orgId,
      canvasId: scope.canvasId,
      gesture,
      actor: userActor(scope)
    });

    if (result.outcome === 'refused') {
      return fail(409, { reason: result.reason });
    }
    return { outcome: 'undone', redo: result.redo };
  },

  /**
   * SUGGERIMENTI DI PROSSIMO PASSO — la tabella (`next-step-actions.ts`) dice cosa ha senso per
   * il tipo del nodo selezionato, la frequenza storica (`next-step-stats.ts`) li ordina, e Jev
   * (se `TYPESAFE_API_KEY` è presente) può solo RI-ordinare lo stesso insieme validato — mai
   * aggiungere un'azione fuori da esso (`suggestNextSteps`, verificato lì).
   */
  suggestNextStep: async ({ request, params, locals }) => {
    const scope = await scopeFor(locals, params.canvasId);
    const fd = await request.formData();

    const nodeId = String(fd.get('node_id') ?? '');
    const suggestions = await nextStepsFor(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, nodeId });
    if (!suggestions) {
      return fail(404, { error: 'node not found' });
    }
    return { suggestions };
  }

};
