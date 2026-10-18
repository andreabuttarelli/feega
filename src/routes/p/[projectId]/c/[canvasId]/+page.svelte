<script lang="ts">
  import { localStore } from '$lib/browser-storage';
  import { Copied, elementClipboard, type CopiedElements } from '$lib/canvas/element-clipboard.svelte';
  import { pasteIntoFrame } from '$lib/canvas/paste-into-frame';
  import type { Stack } from '$lib/canvas/stacking';
  import EmptyCanvas from '$lib/components/canvas/EmptyCanvas.svelte';
  import { CanvasMode, canvasModeFor } from '$lib/canvas/canvas-mode';
  import { EmptyAction, requestChat, showsEmptyState } from '$lib/canvas/empty-canvas';
  import { MediaOrigin, audioNodeFiles } from '$lib/canvas/download';
  /**
   * LA TELA.
   *
   * LO STATO DEI NODI VIVE QUI, IN UN POSTO SOLO (`nodes`), e non è una comodità: fra il gesto e
   * la risposta del server c'è sempre un nodo che esiste solo sullo schermo, e ricaricare i dati
   * a ogni salvataggio farebbe sparire e ricomparire quel che si sta scrivendo. Il server è la
   * verità all'apertura; da lì in poi comanda questa lista. Chi ascolterà `postgres_changes` ha
   * una lista sola da toccare, non tre sparse.
   *
   * IL DISEGNO È DI `CanvasFlow`, che è già scritto e già provato: panning, zoom, selezione col
   * riquadro, il menù del doppio clic e il rifiuto di una linea mentre il puntatore è in aria.
   * Qui si fa l'altra metà — quale riga sta dietro una tile, e cosa si scrive quando cambia.
   */
  import { onCanvasReveal } from '$lib/canvas/canvas-reveal';
  import { DROPPED_EDIT_NOTICE, Trigger, VERDICT_NOTICE, Verdict, carryNotice, changedElsewhere, judge, takeNotice, type RemoteState } from '$lib/canvas/staleness';
  import { keepSame } from '$lib/canvas/snapshot-keep';
  import { AssetSize, sized } from '$lib/canvas/asset-url';
  import TieredImage from '$lib/components/canvas/TieredImage.svelte';
  import LiveVideo from '$lib/components/canvas/LiveVideo.svelte';
  import { mediaPoster, PosterSource, type Poster } from '$lib/canvas/poster-lod';
  import { SaveStatus, SaveTiming, SendResult, createSaveScheduler } from '$lib/canvas/save-scheduler';
  import { createPlaceSaves, keepPending } from '$lib/canvas/place-save';
  import { LineAction, createOpQueue, keepLines } from '$lib/canvas/op-queue';
  import { idbShelf, openOutbox, type Outbox } from '$lib/canvas/outbox';
  import { syncOf } from '$lib/canvas/sync-status';
  import { canvasActionUrl } from '$lib/canvas/canvas-action-url';
  import { baseOf, diffNodeData } from '$lib/canvas/node-patch';
  import { ActionKind, SaveFailure, actAtVersion, actionKind, adoptFrameHead, adoptIdleRows, saveBanner, failureOf, isOwnEcho, keepDirty, keepLocal, orphanedEdits, saveMessage, sendResultOf, serverWritten, writeWithRetry, type ActionAnswer, type WriteOutcome } from '$lib/canvas/node-save';
  import { createUndoStack } from '$lib/canvas/undo-stack';
  import { writesFrameAt, type Gesture, type UndoItem } from '$lib/canvas/undo-plan';
  import { repeatOffset, type LastDuplicate, type Offset } from '$lib/canvas/duplicate-plan';
  import { buildMoveGesture, checkMoveGesture, inverseMoveGesture, type MoveGesture } from '$lib/canvas/move-gesture';
  import { connectCanvas } from '$lib/realtime/canvas-channel';
  import { canvasLink } from '$lib/realtime/canvas-link';
  import type { PresencePeer } from '$lib/realtime/presence-peers';
  import { displayName, frameHub, provideFramePresence } from '$lib/realtime/frame-presence';
  import { adoptCommitted, commitHub, rowsOf } from '$lib/canvas/commit-note';
  import { peerTracks } from '$lib/realtime/peer-tracks';
  import { canvasHub, canvasPeersOf, followed, keepCanvasMark, landedAt, presenterOf, withPeerMotion, type HeldMark } from '$lib/realtime/canvas-presence';
  import PeerAvatars from '$lib/components/canvas/PeerAvatars.svelte';
  import CursorChat from '$lib/components/canvas/CursorChat.svelte';
  import { Portal } from 'bits-ui';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { deserialize } from '$app/forms';
  import { beforeNavigate, goto, invalidate, replaceState } from '$app/navigation';
  import { page, updated } from '$app/state';
  import { track } from '$lib/analytics';
  import { TEMPLATE_AUTO_INSERTED, WELCOME_PARAM, campaignOf } from '$lib/onboarding/campaigns';
  import { CoachStep, ONBOARDING_EVENT, OnboardingStatus, chainOf, stepOf, type CoachChain } from '$lib/onboarding/coach';
  import { DEMO_PRESET, exampleFor, isDemoMedium } from '$lib/onboarding/demo';
  import OnboardingCoach from '$lib/components/canvas/OnboardingCoach.svelte';
  import { offCentre, placeBeside, placeNear, type Rect } from '$lib/canvas/placement';
  import { HOME_PATH } from '$lib/home-path';
  import { CANVAS_LIST_DEPENDENCY } from '$lib/canvas/canvas-list';
  import { formatCredits } from '$lib/components/credit-amount-format';
  import { untrack } from 'svelte';
  import CanvasFlow from '$lib/components/canvas/CanvasFlow.svelte';
  import { Renderer, Switch, rendererOf } from '$lib/canvas/gpu/renderer-flag';
  import RendererBadge from '$lib/components/canvas/gpu/RendererBadge.svelte';
  import { dev } from '$app/environment';
  import { postThumb, productThumb } from '$lib/canvas/source-thumbs';
  import type GpuFlow from '$lib/components/canvas/gpu/GpuFlow.svelte';
  import GenNode from '$lib/components/canvas/GenNode.svelte';
  import IframeNode from '$lib/components/canvas/IframeNode.svelte';
  import DocNode from '$lib/components/canvas/DocNode.svelte';
  import ProductsNode from '$lib/components/canvas/ProductsNode.svelte';
  import SocialFeedNode from '$lib/components/canvas/SocialFeedNode.svelte';
  import InfluencerNode from '$lib/components/canvas/InfluencerNode.svelte';
  import EmptyNode from '$lib/components/canvas/EmptyNode.svelte';
  import { isNodeType } from '$lib/canvas/node-data';
  import UploadedNode from '$lib/components/canvas/UploadedNode.svelte';
  import ListNode from '$lib/components/canvas/ListNode.svelte';
  import SelectNode from '$lib/components/canvas/SelectNode.svelte';
  import NodeDownload from '$lib/components/canvas/NodeDownload.svelte';
  import AudioResult from '$lib/components/canvas/AudioResult.svelte';
  import Model3dViewer from '$lib/components/canvas/Model3dViewer.svelte';
  import { RENDER_VIEWS } from '$lib/canvas/model3d-views';
  import { audioOutputIds } from '$lib/canvas/node-media';
  import NodeReferences from '$lib/components/canvas/NodeReferences.svelte';
  import AudioControls, { type VoiceChoice } from '$lib/components/canvas/AudioControls.svelte';
  import type { CustomVoiceChoice, VoiceAnswer, VoiceSlots } from '$lib/components/canvas/VoiceStudio.svelte';
  import { audioInputKindOf, audioInputPorts, audioNamedOutputs, audioOperationOf, operationSpec, type AudioInputKind, type AudioOperationId } from '$lib/canvas/audio-operations';
  import { referencesOf } from '$lib/canvas/node-references';
  import EffectsNode from '$lib/components/canvas/EffectsNode.svelte';
  import EffectsEditor from '$lib/components/canvas/EffectsEditor.svelte';
  import CompositionNode from '$lib/components/canvas/CompositionNode.svelte';
  import ComponentLibrary from '$lib/components/motion/ComponentLibrary.svelte';
  import { canvasMediaUploader, projectMedia } from '$lib/canvas/media-uploader';
  import type { LibraryMedia, MediaUploader } from '$lib/components/motion/media-upload';
  import { changedRaw } from '$lib/motion/template/raw-values';
  import { templateFields } from '$lib/motion/template/library';
  import { AddTarget, catalogue as componentCatalogue, libraryFormat } from '$lib/motion/template/catalogue';
  import { PENDING_FRAME_TYPE, pendingFrame } from '$lib/canvas/pending-frame';
  import { defaultFrameBox, drawnFrameTile, drawnTile, pendingOutput, placedFrame, settle } from '$lib/canvas/optimistic-insert';
  import { SvelteMap } from 'svelte/reactivity';
  import type { Instance } from '$lib/motion/template/library';
  import { FORMAT_OF_ASPECT, aspectOf, composedTemplate, editedValues, sequentialIds } from '$lib/canvas/composition-template';
  import { Target, composeHtml } from '$lib/motion/hyperframes/compose';
  import { FEEGA_TOKENS } from '$lib/motion/brand';
  import { AssetKind } from '$lib/motion/components';
  import MotionNode from '$lib/components/canvas/MotionNode.svelte';
  import FrameLiveControls from '$lib/components/canvas/FrameLiveControls.svelte';
  import { LiveHost } from '$lib/canvas/frame-live';
  import type { CanvasBox, DrawnWire } from '$lib/motion/draw-create';
  import { FrameKind, frameNodeSize, frameResize, motionEditorPath, type FrameResize, motionLivePath, motionOf, motionPreviewPath, openingFor, ghostShown, posterFresh, tileChromeOf } from '$lib/canvas/motion-node';
  import { NameTag } from '$lib/canvas/node-label';
  import { layoutOf, rotateGroup, scaleGroup, undoTurn, type Placed, type Turn } from '$lib/canvas/node-layout';
  import { FORMATS, MotionFormat, formatOf } from '$lib/motion/doc';
  import { fitToNode } from '$lib/motion/custom-size';
  import { barContextOf } from '$lib/canvas/bottom-bar';
  import { CanvasState, NodeMode, Paint, Reframe, dismissedAfterClick, editorOn, inlineMotionTarget, neighbourStyle, openingOf, reframesOn, tileMode } from '$lib/canvas/inline-motion';
  import { inlineStage } from '$lib/canvas/inline-stage.svelte';
  import { decoded, painted } from '$lib/canvas/paint-wait';
  import { viewportOf } from '$lib/motion/editor-layout';
  import { FocusMode, type FocusRequest, type Insets } from '$lib/canvas/free-area';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { frameHead } from '$lib/canvas/frame-outlines';
  import InlineMotionEditor, { prefetchSession } from '$lib/components/canvas/InlineMotionEditor.svelte';
  import { newStudioBatchData, studioBatchOf } from '$lib/canvas/studio-batch-node';
  import StudioBatchNode from '$lib/components/canvas/StudioBatchNode.svelte';
  import { DragPhase, DropVerdict, frameUnderPointer, type CanvasUndo, type ElementOut, type HostMove, type PointerPoint } from '$lib/canvas/canvas-drop';
  import { canvasSelection } from '$lib/canvas/promote-sheet';
  import { propertiesRequest, propertiesTarget, targetOf } from '$lib/canvas/phone-properties';
  import { DropOn, type Drop } from '$lib/motion/move-element';
  import { inputChanged } from '$lib/canvas/effects/editor';
  import { cutoutTwin, upstreamMedia } from '$lib/canvas/effects-node';
  import type { EffectStep } from '$lib/canvas/effects';
  import { hasCutout } from '$lib/canvas/effects/shape-cutout';
  import { upstreamCards as compositionCards, cardAssetIds } from '$lib/canvas/composition-node';
  import { listFeedingSelect } from '$lib/canvas/select-node';
  import { fieldValue, productItem, socialPostItem } from '$lib/canvas/select-sources';
  import { isOutputHandle, outputValues, portOfOutputHandle, selectOutputs, sourceOutputs, type OutputValue, type SelectOutput } from '$lib/canvas/select-outputs';
  import { feedFiltersOf, filterPosts, filterProducts, productFiltersOf } from '$lib/canvas/source-filters';
  import { hasInspector, inspectorOf } from '$lib/canvas/node-inspector';
  import SourceSettingsFrame from '$lib/components/canvas/SourceSettingsFrame.svelte';
  import {
    listConnectors,
    listKindOf,
    listValues,
    wiredKindOf,
    wiresInto,
    type ListItem,
    type ListItemKind,
    type ListNode as ListNodeState,
    type ListValues,
    type WiredListSource
  } from '$lib/canvas/list-node';
  import { verdictForUpload, canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { isUploadedNodeRow, uploadedNodeOf } from '$lib/canvas/uploaded-node';
  import { genNodeSize, startRun, unlockRun, type GenNode as GenNodeState, type GenMedium, type ModelChoice } from '$lib/canvas/gen-node';
  import type { GenPropertyType } from '$lib/canvas/common-properties';
  import { hasUpstreamText } from '$lib/canvas/upstream-inputs';
  import { effectiveModel } from '$lib/canvas/default-models';
  import { nearestVideoDuration } from '$lib/video-models';
  import { snapAspectRatio, snapResolution } from '$lib/canvas/gen-node';
  import { snapDynamicParams } from '$lib/canvas/model-params';
  import { type IframeNode as IframeNodeState } from '$lib/canvas/iframe-node';
  import { shareUrlOf } from '$lib/canvas/doc-node';
  import { nodeSize } from '$lib/canvas/node-size';
  import { grownTextNodeHeight } from '$lib/canvas/text-node-grow';
  import { scrollGuard } from '$lib/canvas/scroll-guard';
  import { loadTextViewMode, storeTextViewMode, type TextViewMode } from '$lib/canvas/text-view-mode';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import '$lib/styles/doc-prose.css';
  import { producedRuns } from '$lib/canvas/gen-history';
  import { runQuoteOf, type RunQuote } from '$lib/canvas/run-quote';
  import { type Addable } from '$lib/canvas/addable';
  import type { FilledNodeDrag } from '$lib/canvas/drag-payload';
  import { tileNode } from '$lib/canvas/connect-rules';
  import { planDelete } from '$lib/canvas/delete-plan';
  import { connectorsFor, orphanedByModelChange, type ConnectorType, type GenerativeNodeKind, connectorsForNode } from '$lib/canvas/connectors';
  import { portsOf } from '$lib/canvas/node-ports';
  import { needsUncensoredConfirm } from '$lib/canvas/uncensored-switch';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import FormatsDialog from '$lib/components/canvas/FormatsDialog.svelte';
  import type { FormatTarget } from '$lib/motion/reformat';
  import RunsPanel from '$lib/components/canvas/RunsPanel.svelte';
  import { GraphScope, nodeOutputs, recentRuns, staleIds } from '$lib/canvas/run-graph';
  import { planConnectSelection, type ConnectSource } from '$lib/canvas/connect-selection-plan';
  import {
    docData,
    docOf,
    frameData,
    frameOf,
    genData,
    genOf,
    genPatch,
    influencerOf,
    listData,
    listOf,
    newNodeRow,
    productsOf,
    selectData,
    selectOf,
    effectsOf,
    effectsData,
    compositionOf,
    socialFeedOf
  } from '$lib/canvas-node-data';
  import {
    isCanvasEdgeKind,
    type CanvasEdgeKind,
    type FlowEdge,
    type WireMode
  } from '$lib/canvas-edges';
  import { loopAffordance, type LoopSourceNode } from '$lib/canvas/loop-axes';
  import type { CanvasNodeRecord, Connection } from '$lib/server/repos/canvas';
  import type { Product } from '$lib/server/repos/products';
  import type { SocialPost } from '$lib/server/repos/social-posts';
  import { BILLING_PATH } from '$lib/billing-path';

  let { data } = $props();

  function announceWelcome() {
    const campaign = campaignOf(page.url.searchParams.get(WELCOME_PARAM));
    if (!campaign) {
      return;
    }

    track(TEMPLATE_AUTO_INSERTED, { campaign });
    const clean = new URL(page.url);
    clean.searchParams.delete(WELCOME_PARAM);
    replaceState(clean, page.state);
  }

  $effect(() => {
    untrack(announceWelcome);
  });

  let coachOpen = $state(untrack(() => data.onboarding.visible));
  let coachBusy = $state(false);
  let generatedOnce = untrack(() => data.onboarding.hasGenerated);
  let coachSeenStep: CoachStep | null = null;

  $effect(() => {
    if (untrack(() => data.onboarding.started)) {
      track(ONBOARDING_EVENT.started);
    }
  });

  function noteFirstGeneration() {
    if (generatedOnce) {
      return;
    }
    generatedOnce = true;
    track(ONBOARDING_EVENT.firstRealGeneration);
  }
  type TextCostEstimate = { inputTokens: number; outputTokens: number; variableInput: boolean; revision: string; asked: string };
  let textCostEstimates = $state<Record<string, TextCostEstimate>>({});
  let voices = $state<VoiceChoice[]>([]);
  let voicesError = $state<string | null>(null);
  let voicesLoading = false;
  let customVoices = $state<CustomVoiceChoice[]>([]);
  let voiceSlots = $state<VoiceSlots | null>(null);

  async function loadVoices() {
    if (voicesLoading) {
      return;
    }
    voicesLoading = true;
    const result = await post('audio_voices', {});
    voicesLoading = false;
    const found = (result?.voices as VoiceChoice[] | undefined) ?? [];
    voices = found;
    customVoices = (result?.custom as CustomVoiceChoice[] | undefined) ?? [];
    voiceSlots = (result?.slots as VoiceSlots | undefined) ?? null;
    voicesError = found.length ? null : 'No voices available';
  }

  async function voiceAction(action: string, fields: Record<string, string | File>): Promise<VoiceAnswer> {
    const result = await send(action, fields);
    if (result.type === 'success') {
      return { ok: true, data: (result.data ?? {}) as Record<string, unknown> };
    }
    const detail = (result.data ?? {}) as { message?: string };
    return { ok: false, message: detail.message ?? saveMessage(failureOf(result), detail) };
  }

  const FRAME_DROP_CLASS = 'is-frame-drop';

  let toFlow: ((p: PointerPoint) => PointerPoint) | null = null;

  function markFrame(at: PointerPoint | null, exceptId: string | null) {
    const target = at ? frameUnderPointer(at, exceptId) : null;
    for (const el of document.querySelectorAll<HTMLElement>(`.${FRAME_DROP_CLASS}`)) {
      if (el.dataset.motionNode !== target?.frameId) { el.classList.remove(FRAME_DROP_CLASS); }
    }
    if (target) { document.querySelector(`[data-motion-node="${target.frameId}"]`)?.classList.add(FRAME_DROP_CLASS); }
  }

  function dropAt(client: PointerPoint, exceptId: string | null): Drop | null {
    const frame = frameUnderPointer(client, exceptId);
    if (frame) {
      return { on: DropOn.Frame, nodeId: frame.frameId, at: frame.at };
    }
    const at = toFlow?.(client);
    return at ? { on: DropOn.Canvas, x: at.x, y: at.y } : null;
  }

  function landed(res: Record<string, unknown> | null): boolean {
    if (res?.outcome !== 'done') {
      return false;
    }
    pushGesture({ items: (res.undo ?? []) as UndoItem[] });
    void refresh();
    return true;
  }

  async function moveOut(out: ElementOut, phase: DragPhase, version: number): Promise<number | null> {
    const source = inlineMotion;
    markFrame(phase === DragPhase.Over ? out.client : null, source);
    const drop = phase === DragPhase.Drop && source ? dropAt(out.client, source) : null;
    if (!source || !drop) {
      return null;
    }
    const res = await post('moveElement', { source, clip: out.clipId, drop: JSON.stringify(drop), versions: JSON.stringify({ [source]: version }), ...(out.box ? { box: JSON.stringify(out.box) } : {}) });
    return landed(res) ? ((res?.versions as Record<string, number>)[source] ?? null) : null;
  }

  const canvasundo: CanvasUndo = {
    owns: (nodeId, version) => {
      const next = undoStack.nextUndo();
      return next?.source === 'server' && writesFrameAt(next.gesture, nodeId, version);
    },
    run: () => undo()
  };

  const freeElement = (ids: string[]): string | null => {
    const row = ids.length === 1 ? nodes.find((n) => n.id === ids[0]) : null;
    const holdsNodes = row ? nodes.some((n) => layoutOf(n.data).groupId === row.id) : false;
    return row && !tileChromeOf(row).takesDrops && !holdsNodes ? row.id : null;
  };

  function tileDragOver(ids: string[], client: PointerPoint) {
    const id = freeElement(ids);
    markFrame(id ? client : null, id);
  }

  function tileDrop(ids: string[], client: PointerPoint): DropVerdict {
    markFrame(null, null);
    const id = freeElement(ids);
    const frame = id ? frameUnderPointer(client, id) : null;
    if (!id || !frame) {
      return DropVerdict.Ignored;
    }
    void post('moveFree', { source: id, drop: JSON.stringify({ on: DropOn.Frame, nodeId: frame.frameId, at: frame.at }) }).then((res) => {
      if (landed(res)) {
        nodes = nodes.filter((n) => n.id !== id);
      }
    });
    return DropVerdict.Taken;
  }

  type HostBox = { id: string; x: number; y: number; w: number; h: number };
  const HOST_MIN_PX = 4;
  let hostOrigin: HostBox | null = null;

  const placeHost = (box: HostBox) => (nodes = nodes.map((n) => (n.id !== box.id ? n : n.w === box.w && n.h === box.h ? { ...n, x: box.x, y: box.y } : { ...n, x: box.x, y: box.y, w: box.w, h: box.h, userHeight: box.h })));

  let turnFrom: { id: string; rotation: number } | null = null;

  const turnTo = (id: string, rotation: number) => (nodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, rotation } } : n)));

  function hostTurn(id: string, rotation: number, turn: number, phase: DragPhase) {
    turnFrom = turnFrom?.id === id ? turnFrom : { id, rotation };
    const from = turnFrom.rotation;
    if (phase !== DragPhase.Drop) {
      turnTo(id, from + turn);
      return;
    }
    turnFrom = null;
    turnTo(id, from);
    if (turn !== 0) {
      rotateGroupBy(id, turn);
    }
  }

  function hostDrag({ turn, ...shift }: HostMove, to: PointerPoint, phase: DragPhase) {
    const id = inlineMotion;
    const row = id ? nodes.find((n) => n.id === id) : null;
    if (id && row && (turn !== 0 || turnFrom)) {
      hostTurn(id, layoutOf(row.data).rotation, turn, phase);
      return;
    }
    const zero = toFlow?.({ x: 0, y: 0 });
    const unit = toFlow?.({ x: 1, y: 1 });
    if (!id || !row || !zero || !unit) {
      return;
    }
    const scale = unit.x - zero.x;
    const origin = hostOrigin?.id === id ? hostOrigin : { id, x: row.x, y: row.y, w: row.w, h: row.h };
    hostOrigin = origin;
    const next = { id, x: origin.x + shift.dx * scale, y: origin.y + shift.dy * scale, w: Math.max(HOST_MIN_PX, origin.w + shift.dw * scale), h: Math.max(HOST_MIN_PX, origin.h + shift.dh * scale) };
    const sized = next.w !== origin.w || next.h !== origin.h;
    if (phase !== DragPhase.Drop) {
      placeHost(next);
      cursors.port.update({ live: [{ id, x: next.x, y: next.y }] });
      if (!sized) {
        tileDragOver([id], to);
      }
      return;
    }
    hostOrigin = null;
    cursors.port.update({ live: [] });
    placeHost(origin);
    if (!sized && tileDrop([id], to) === DropVerdict.Taken) {
      return;
    }
    if (next.x !== origin.x || next.y !== origin.y) {
      void moveEnd([{ id, x: next.x, y: next.y }]);
      void move(id, next.x, next.y);
    }
    if (sized) {
      void resize(id, next.w, next.h);
    }
  }

  async function regroup(action: string, fields: Record<string, string>) {
    const res = await post(action, fields);
    if (res?.outcome !== 'done') {
      return;
    }
    pushGesture({ items: (res.undo ?? []) as UndoItem[] });
    await refresh();
  }

  function rotateGroupBy(id: string, degrees: number) {
    if (turnGroup({ id, degrees })) {
      undoStack.push({ source: 'turn', turn: { id, degrees } });
    }
  }

  function turnGroup({ id, degrees }: Turn): boolean {
    const group = nodes.find((n) => n.id === id);
    if (!group) {
      return false;
    }
    const placed = (n: Tile): Placed => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, rotation: layoutOf(n.data).rotation });
    const turned = new Map(rotateGroup(placed(group), nodes.filter((n) => layoutOf(n.data).groupId === id).map(placed), degrees).map((t) => [t.id, t]));
    nodes = nodes.map((n) => {
      const t = turned.get(n.id);
      return t ? { ...n, x: t.x, y: t.y, data: { ...n.data, rotation: t.rotation } } : n;
    });
    void post('rotateGroup', { id, degrees: String(degrees) });
    return true;
  }

  function groupElements(ids: string[]) {
    if (ids.length > 1) {
      void regroup('groupElements', { ids: JSON.stringify(ids) });
    }
  }

  function ungroupElements(ids: string[]) {
    for (const id of ids) {
      void regroup('ungroupElement', { id });
    }
  }

  async function restack(ids: string[], to: Stack) {
    const res = await post('restack', { ids: JSON.stringify(ids), to });
    if (res) {
      await refresh();
    }
  }

  async function drawElement(drawn: DrawnWire) {
    const id = crypto.randomUUID();
    const ghost = drawnTile(id, drawn);
    if (!ghost) {
      void saveDrawn(id, drawn);
      return;
    }
    await decoded(ghost.look);
    catalogPosters.set(id, ghost.look);
    nodes = [...nodes, toTile(ghost.node)];
    void saveDrawn(id, drawn);
    await painted();
  }

  async function drawFrame(target: { box: CanvasBox } | { at: { x: number; y: number } }) {
    const box = 'box' in target ? target.box : defaultFrameBox(target.at);
    const id = crypto.randomUUID();
    nodes = [...nodes, toTile(drawnFrameTile(id, box))];
    void saveFrame(id, box);
    await painted();
  }

  async function saveFrame(id: string, box: CanvasBox) {
    const res = await post('drawFrame', { box: JSON.stringify(box), node_id: id });
    const node = res?.outcome === 'done' ? (res.node as CanvasNodeRecord | null) : null;
    if (!node) {
      nodes = settle(nodes, id, null);
      return;
    }
    pushGesture({ items: (res?.undo ?? []) as UndoItem[] });
    nodes = settle(nodes, id, toTile(node));
    focusOn([id], undefined, FocusMode.Select);
  }

  async function saveDrawn(id: string, drawn: DrawnWire) {
    const res = await post('drawElement', { drawn: JSON.stringify(drawn), node_id: id });
    const node = res?.outcome === 'done' ? (res.node as CanvasNodeRecord | null) : null;
    if (!node) {
      catalogPosters.delete(id);
      nodes = settle(nodes, id, null);
      return;
    }
    pushGesture({ items: (res?.undo ?? []) as UndoItem[] });
    nodes = settle(nodes, id, toTile(node));
    focusOn([id], undefined, FocusMode.Select);
  }

  $effect(() => {
    const id = inlineMotion;
    if (id && catalogPosters.has(id) && inlineStage.paintOf(id) === Paint.Swapped) {
      catalogPosters.delete(id);
    }
  });

  async function dropOutput(nodeId: string, client: PointerPoint) {
    const drop = dropAt(client, null);
    if (!drop) {
      return;
    }
    if (drop.on !== DropOn.Canvas) {
      landed(await post('placeOutput', { source: nodeId, drop: JSON.stringify(drop) }));
      return;
    }

    const id = crypto.randomUUID();
    const source = nodes.find((n) => n.id === nodeId);
    const file = source?.data.refId ?? source?.data.assetId;
    const picture = assetUrl(typeof file === 'string' ? file : null);
    if (picture) {
      catalogPosters.set(id, picture);
    }
    nodes = [...nodes, toTile(pendingOutput(id, drop))];
    const res = await post('placeOutput', { source: nodeId, drop: JSON.stringify(drop), node_id: id });
    const node = res?.outcome === 'done' ? (res.node as CanvasNodeRecord | null) : null;
    nodes = settle(nodes, id, node ? toTile(node) : null);
    if (!node) {
      catalogPosters.delete(id);
      return;
    }
    pushGesture({ items: (res?.undo ?? []) as UndoItem[] });
  }

  /** Una riga come la pagina la tiene: quel che il database ha, più dove sta sullo schermo. */
  type Tile = {
    id: string;
    type: string;
    displayName: string | null;
    data: Record<string, unknown>;
    saved: Record<string, unknown>;
    version: number;
    x: number;
    y: number;
    w: number;
    h: number;
    /** `node.size.height` così come sta in database, prima di ogni scelta di ripiego: `null`
     *  vuol dire "l'utente non ha mai ridimensionato a mano", il segnale che il nodo testo può
     *  crescere da solo (`grownTextNodeHeight`, `text-node-grow.ts`). */
    userHeight: number | null;
    /** Appena nata da un gesto di QUESTO client — `CanvasFlow`/`syncNodes` la selezionano, una
     *  volta sola. Mai vero da `refresh()`/dal primo carico: un inserimento realtime da un
     *  collega non deve rubare la selezione locale. */
    select?: boolean;
  };

  function sizeOf(node: CanvasNodeRecord): { w: number; h: number } {
    const { w, h } = nodeSize(node.type, node.data);
    return { w: node.size.width ?? w, h: node.size.height ?? h };
  }

  function toTile(node: CanvasNodeRecord, opts: { select?: boolean } = {}): Tile {
    return {
      id: node.id,
      type: node.type,
      displayName: node.displayName,
      data: node.data,
      saved: node.data,
      version: node.version,
      x: node.position.x,
      y: node.position.y,
      userHeight: node.size.height,
      select: opts.select,
      ...sizeOf(node)
    };
  }

  let nodes = $state<Tile[]>((data.nodes as CanvasNodeRecord[]).map((n) => toTile(n)));

  /**
   * QUANTO IL CONTENUTO DI UN NODO TESTO CHIEDE, misurato dal DOM — mai scritto in database, mai
   * la ragione per cui `write()` parte: solo lo schermo. `GenNode` lo riporta a ogni cambio
   * (`onmeasure`), `tiles` lo applica clampato (`grownTextNodeHeight`) finché l'utente non ha
   * ridimensionato a mano quel nodo — allora `Tile.userHeight` vince e questa mappa non conta più.
   */
  let grownHeights = $state<Record<string, number>>({});

  /**
   * RAW O MARKDOWN, PER NODO E PER CHI GUARDA — mai scritto sul nodo: due persone sullo stesso
   * testo possono leggerlo in due forme diverse, e non è uno stato del contenuto, è una
   * preferenza di lettura. `localStorage` (`text-view-mode.ts`, avvolto in try/catch) la porta
   * fra un'apertura e l'altra; questa mappa è solo la cache in RAM di quello storage per non
   * rileggerlo a ogni fotogramma.
   */
  let textViewModes = $state<Record<string, TextViewMode>>({});

  const clientStorage = localStore() ?? undefined;

  function textViewModeOf(nodeId: string): TextViewMode {
    return textViewModes[nodeId] ?? loadTextViewMode(clientStorage, nodeId);
  }

  function setTextViewMode(nodeId: string, mode: TextViewMode) {
    textViewModes[nodeId] = mode;
    storeTextViewMode(clientStorage, nodeId, mode);
  }

  /**
   * IL VERSO DI UNA LINEA STA SU `source_handle`. `nodes_connections` non ha una colonna per il
   * verso, e gli attacchi sono due — uno solo per lato — quindi quel campo è libero e porta
   * l'unica cosa che altrimenti si perderebbe: senza, riaprire la tela mostrerebbe ogni linea
   * tornata «nasce da», che è un dato falso scritto da nessuno.
   */
  function edgeKindOf(connection: Connection): CanvasEdgeKind {
    const handle = connection.sourceHandle ?? '';
    return isCanvasEdgeKind(handle) ? handle : 'derives_from';
  }

  function toEdge(connection: Connection): FlowEdge {
    const kind = edgeKindOf(connection);
    return {
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      targetHandle: connection.targetHandle,
      ...(isOutputHandle(connection.sourceHandle) ? { sourceHandle: connection.sourceHandle } : {}),
      kind,
      mode: connection.mode,
      ...(kind === 'groups_with' ? {} : { markerEnd: { type: 'arrowclosed' as const } })
    };
  }

  let edges = $state<FlowEdge[]>((data.connections as Connection[]).map(toEdge));

  const coachGraph = $derived({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, example: n.data.example === true })),
    edges: edges.map((e) => ({ source: e.source, target: e.target }))
  });
  const coachChain = $derived(chainOf(coachGraph));
  const coachStep = $derived(stepOf(coachGraph));

  $effect(() => {
    const step = coachStep;
    if (!coachOpen) {
      return;
    }
    untrack(() => {
      if (coachSeenStep !== null && coachSeenStep !== step) {
        track(ONBOARDING_EVENT.stepCompleted, { step: coachSeenStep });
        focusOn(coachIds(coachChain));
      }
      coachSeenStep = step;
    });
  });

  $effect(() => {
    const chain = coachChain;
    if (!coachOpen) {
      return;
    }
    untrack(() => prefillCoach(chain));
  });

  function coachIds(chain: CoachChain): string[] {
    return [chain.text, chain.image, chain.video].filter((id): id is string => !!id);
  }

  function prefillCoach(chain: CoachChain) {
    for (const id of coachIds(chain)) {
      const row = nodes.find((n) => n.id === id);
      const gen = row ? genOf(row) : null;
      if (!gen || gen.prompt || !isDemoMedium(gen.medium)) {
        continue;
      }
      const preset = DEMO_PRESET[gen.medium];
      changeGen(id, gen, { ...preset, params: { ...gen.params, ...preset.params } });
    }
  }

  function cheapestForRealRun(chain: CoachChain) {
    for (const id of coachIds(chain)) {
      const row = nodes.find((n) => n.id === id);
      const gen = row ? genOf(row) : null;
      if (!gen || !isDemoMedium(gen.medium) || !DEMO_PRESET[gen.medium].model) {
        continue;
      }
      const preset = DEMO_PRESET[gen.medium];
      changeGen(id, gen, { model: preset.model, params: { ...gen.params, ...preset.params } });
    }
  }

  async function coachRun() {
    coachBusy = true;
    const result = await post('demo_run', {});
    coachBusy = false;
    if (result) {
      await refresh();
      focusOn(coachIds(coachChain));
    }
  }

  async function endCoach(status: OnboardingStatus.Dismissed | OnboardingStatus.Completed) {
    coachOpen = false;
    await post('onboarding_end', { status });
  }

  async function coachDismiss() {
    track(ONBOARDING_EVENT.dismissed, { step: coachStep });
    await endCoach(OnboardingStatus.Dismissed);
  }

  async function coachGenerate() {
    const chain = coachChain;
    const ids = coachIds(chain);
    cheapestForRealRun(chain);
    await Promise.all(ids.map((id) => saves.flush(id)));

    coachBusy = true;
    const started = await runWorkflow(ids);
    coachBusy = false;
    if (!started) {
      return;
    }

    track(ONBOARDING_EVENT.completed);
    await endCoach(OnboardingStatus.Completed);
  }

  function toGenRun(run: {
    id: string;
    outputAssetId: string | null;
    prompt: string | null;
    model: string | null;
    startedAt: string;
    text?: string | null;
  }) {
    return {
      id: run.id,
      mediaId: run.outputAssetId,
      prompt: run.prompt ?? '',
      model: run.model,
      createdAt: run.startedAt,
      text: run.text ?? null
    };
  }

  let runsOverride = $state<Record<string, unknown[]> | null>(null);
  const runs = $derived(runsOverride ?? ((data.runs ?? {}) as Record<string, unknown[]>));

  const runsByNode = $derived(
    Object.fromEntries(
      Object.entries(runs).map(([id, rows]) => [
        id,
        producedRuns((rows as Parameters<typeof toGenRun>[0][]).map(toGenRun))
      ])
    )
  );

  /**
   * SE UN NODO CHE PRODUCE HA UN TESTO A MONTE DA CONTARE COME PROMPT (CLAUDE.md: un'immagine
   * wired a un testo scritto è pronta anche senza un prompt suo). `sourceTextOf` legge lo stesso
   * testo che il server leggerebbe (`upstream.ts::sourceText`): il testo generato quando il nodo
   * l'ha già mostrato, altrimenti il suo prompt/contenuto mai girato — un nodo mai girato dà
   * comunque quel che c'è scritto, non sparisce dal giro a valle.
   */
  function sourceTextOf(node: Tile): string | null {
    if (node.type === 'doc') {
      const content = typeof node.data.content === 'string' ? node.data.content : '';
      return content.trim() ? content : null;
    }
    const refId = typeof node.data.refId === 'string' ? node.data.refId : null;
    const shown = refId ? (runsByNode[node.id] ?? []).find((r) => r.mediaId === refId)?.text : null;
    if (shown) return shown;
    const prompt = typeof node.data.prompt === 'string' ? node.data.prompt : '';
    return prompt.trim() ? prompt : null;
  }

  const hasUpstreamTextByNode = $derived.by(() => {
    const upstreamNodes = nodes.map((n) => ({ id: n.id, type: n.type, text: sourceTextOf(n), outputs: selectValuesOf(n) }));
    const upstreamEdges = edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target, sourceHandle: e.sourceHandle ?? null }));
    return Object.fromEntries(nodes.map((n) => [n.id, hasUpstreamText(upstreamNodes, upstreamEdges, n.id)]));
  });

  function textEstimateRevision(nodeId: string): string {
    return JSON.stringify(
      edges
        .filter((edge) => edge.target === nodeId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((edge) => {
          const source = nodes.find((node) => node.id === edge.source);
          return [edge, source?.version, source?.data, source ? sourceTextOf(source) : null];
        })
    );
  }

  /** Quanti biglietti di loop sono ancora `queued` per nodo — non ancora reclamati da un tick.
   *  `data.runs` porta OGNI riga `node_runs`, biglietti compresi (`runsOf` non li filtra, sono
   *  righe come le altre): la stessa lista che alimenta `runsByNode`, letta prima che
   *  `toGenRun` scarti `status`/`params`, i due campi che dicono se una riga è un biglietto. */
  const loopQueuedByNode = $derived(
    Object.fromEntries(
      Object.entries(runs as Record<string, { status?: string; params?: { loop?: { phase?: string } } }[]>).map(
        ([id, rows]) => [id, rows.filter((r) => r.status === 'running' && r.params?.loop?.phase === 'queued').length]
      )
    )
  );

  /** L'output di ora di un nodo collegato a una lista, nella forma di un item — la stessa lettura
   *  che il server fa in `upstream.ts::wiredItem`: l'asset dell'ultimo giro, o `sourceTextOf`. */
  function wiredItemOf(n: Tile, kind: ListItemKind): ListItem | null {
    if (kind === 'text') {
      const text = sourceTextOf(n);
      return text ? { text } : null;
    }
    const refId = typeof n.data.refId === 'string' ? n.data.refId : null;
    return refId ? { asset_id: refId, url: `/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}` } : null;
  }

  function wiredSourcesOf(listId: string): WiredListSource[] {
    const listEdges = edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target }));
    return wiresInto(listId, listEdges).flatMap((e) => {
      const source = nodes.find((n) => n.id === e.sourceNodeId);
      const kind = source ? wiredKindOf(source.type) : null;
      return source && kind ? [{ nodeId: source.id, kind, item: wiredItemOf(source, kind) }] : [];
    });
  }

  /** I valori di ogni `list`, via `listValues` — la stessa funzione del server: la tile, il loop e
   *  il `select` leggono questa mappa, mai `items` da soli. */
  const listValuesByNode = $derived(
    Object.fromEntries(
      nodes.flatMap((n) => {
        const list = listOf(n);
        return list ? [[n.id, listValues(list, wiredSourcesOf(n.id))]] : [];
      })
    ) as Record<string, ListValues>
  );

  const listPortsByNode = $derived(
    Object.fromEntries(
      nodes.flatMap((n) => {
        const list = listOf(n);
        return list ? [[n.id, listConnectors(listKindOf(list, wiredSourcesOf(n.id)))]] : [];
      })
    ) as Record<string, ConnectorType[]>
  );

  /** Ogni nodo, per id — la stessa lettura che `listFeedingSelect` chiede, minima apposta. */
  const nodesById = $derived(new Map(nodes.map((n) => [n.id, { id: n.id, type: n.type }])));

  /** Quanti item porta un nodo, qualunque sia la sua sorgente — una `list` conta i suoi valori
   *  risolti, `products`/`social_account_feed` contano le righe sincronizzate che la pagina ha già
   *  in mano (`data.products`/`data.socialPosts`, lette da `load`): la stessa tabella di
   *  `select-node.ts::SELECTABLE_SOURCE_TYPES`, qui applicata al conteggio invece che al filtro. */
  function itemCountOf(n: Tile): number {
    if (n.type === 'products') return shownProducts[n.id]?.length ?? 0;
    if (n.type === 'social_account_feed') return shownPosts[n.id]?.length ?? 0;
    return listValuesByNode[n.id]?.values.length ?? 0;
  }

  /** Ogni nodo, per id, con quanti item porta — la lettura che `loopAffordance` chiede per
   *  contare gli assi di un loop. */
  const loopSourceNodesById = $derived(
    new Map<string, LoopSourceNode>(nodes.map((n) => [n.id, { id: n.id, type: n.type, itemCount: itemCountOf(n) }]))
  );

  /** Se il bottone Loop si vede su un nodo, e con quante combinazioni — un filo `iterate` la
   *  cui sorgente porta >=2 valori (un asse), calcolato prima di aprire il pannello, non dopo. */
  const loopAffordanceByNode = $derived(
    Object.fromEntries(
      nodes.map((n) => [
        n.id,
        loopAffordance(
          n.id,
          edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target, mode: e.mode ?? 'fixed' })),
          loopSourceNodesById
        )
      ])
    )
  );

  /** Un `products`/`social_account_feed` come `ListNodeState` — la stessa forma che `SelectNode`
   *  già disegna per una `list`, con `productItem`/`socialPostItem` (`select-sources.ts`) a
   *  tradurre ogni riga sincronizzata in un item: la stessa tabella per tipo che `upstream.ts`
   *  usa lato server, qui applicata all'anteprima invece che alla generazione. */
  function syncedSourceListOf(source: { id: string; type: string }): ListNodeState {
    const rows = source.type === 'products' ? (shownProducts[source.id] ?? []).map(productItem) : (shownPosts[source.id] ?? []).map(socialPostItem);

    return {
      id: source.id,
      itemKind: rows.some((r) => r.mediaUrls.length) ? 'image' : 'text',
      items: rows.map((r) => ({ text: r.text ?? undefined, url: r.mediaUrls[0] }))
    };
  }

  /** La sorgente che alimenta un `select`, o null — `listFeedingSelect` sceglie il primo arco
   *  entrante la cui sorgente è in `SELECTABLE_SOURCE_TYPES`, la stessa disciplina di
   *  `upstream.ts::listFeeding`. */
  function upstreamListOf(selectId: string): ListNodeState | null {
    const upstreamEdges = edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target }));
    const source = listFeedingSelect(selectId, upstreamEdges, nodesById);
    if (!source) return null;
    if (source.type === 'products' || source.type === 'social_account_feed') return syncedSourceListOf(source);
    const values = listValuesByNode[source.id];
    return values ? { id: source.id, itemKind: values.itemKind, items: values.values.map((v) => v.item) } : null;
  }

  function selectSourceOf(selectId: string): { id: string; type: string } | null {
    const upstreamEdges = edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target }));
    return listFeedingSelect(selectId, upstreamEdges, nodesById);
  }

  function syncedRowAt(source: { id: string; type: string }, index: number) {
    const rows = source.type === 'products' ? shownProducts[source.id] : source.type === 'social_account_feed' ? shownPosts[source.id] : undefined;
    return rows?.[index - 1] ?? null;
  }

  function selectOutputsOf(n: Tile): SelectOutput[] {
    const select = n.type === 'select' ? selectOf(n) : null;
    return select ? selectOutputs(selectSourceOf(n.id)?.type ?? null, select.outputs) : [];
  }

  function selectValuesOf(n: Tile): Record<string, OutputValue> | undefined {
    const select = n.type === 'select' ? selectOf(n) : null;
    const source = select ? selectSourceOf(n.id) : null;
    const row = source && select ? syncedRowAt(source, select.index) : null;
    if (!select || !source || !row) {
      return undefined;
    }
    return source.type === 'products'
      ? outputValues('products', row as Product, select.outputs)
      : outputValues('social_account_feed', row as SocialPost, select.outputs);
  }

  function selectFieldPreview(selectId: string, index: number, field: string) {
    const source = selectSourceOf(selectId);
    const row = source ? syncedRowAt(source, index) : null;
    if (!source || !row) {
      return null;
    }
    return source.type === 'products' ? fieldValue('products', field, row as Product) : fieldValue('social_account_feed', field, row as SocialPost);
  }

  function upstreamEffectsMediaOf(effectsId: string) {
    return upstreamMedia(effectsId, edges, nodes);
  }

  function assetUrl(refId: string | null): string | null {
    return refId ? `/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}` : null;
  }

  function cardAssets(cards: ReturnType<typeof compositionCards>): Record<string, string> {
    return Object.fromEntries(cardAssetIds(cards).map((id) => [id, sized(assetUrl(id)!, AssetSize.Px1024)]));
  }

  /** Da un nodo `list` al nodo che GENERA che lo tiene come proprio output di loop
   *  (`data.outputListNodeId`, `loop.ts::createOutputList`) — assente quando la lista non è mai
   *  stata l'output di un loop, e in quel caso non c'è "ritenta" da offrire: ritentare un item
   *  vuol dire rilanciare la STESSA generazione che l'ha prodotto, e senza il nodo che genera non
   *  c'è un prompt/modello da rilanciare. */
  const loopOutputByNode = $derived(
    Object.fromEntries(
      nodes
        .filter((n) => typeof n.data.outputListNodeId === 'string')
        .map((n) => [n.data.outputListNodeId as string, n.id])
    )
  );

  const mediumCatalogue = $derived(
    (data.catalogue ?? {
      text: { choices: [], synced: true },
      image: { choices: [], synced: false },
      video: { choices: [], synced: false },
      audio: { choices: [], synced: false }
    }) as Record<GenMedium, { choices: ModelChoice[]; synced: boolean; enhanceUnitCredits?: number }>
  );
  const catalogue = $derived(
    Object.fromEntries(
      Object.entries(mediumCatalogue).map(([medium, { choices }]) => [medium, choices])
    ) as Record<GenMedium, ModelChoice[]>
  );

  /**
   * IL CATALOGO E IL FEED SCARICATI, per nodo. Come `runsByNode`: `products`/`social_account_feed`
   * non portano il contenuto in `data.data` — vive in `products`/`social_posts` — quindi arriva
   * qui, letto dal server in `load` e riletto a ogni `refresh()`.
   */
  const productsByNode = $derived((data.products ?? {}) as Record<string, Product[]>);
  const socialPostsByNode = $derived((data.socialPosts ?? {}) as Record<string, SocialPost[]>);
  type InfluencerTile = { name: string; views: { id: string; label: string; url: string | null }[] };
  let influencersOverride = $state<Record<string, InfluencerTile> | null>(null);
  const influencersByNode = $derived(influencersOverride ?? ((data.influencers ?? {}) as Record<string, InfluencerTile>));

  const itemPortOf = (kind: string | undefined): ConnectorType => (kind === 'text' ? 'text' : 'images');

  function uncensoredModelOf(n: Tile): boolean {
    if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') {
      return false;
    }
    const model = typeof n.data.model === 'string' ? n.data.model : null;
    return catalogue[n.type]?.find((c) => c.id === model)?.uncensored === true;
  }

  function audioOperationOfTile(n: Tile): AudioOperationId {
    return audioOperationOf((n.data.params ?? {}) as { operation?: unknown });
  }

  function wiredPortOf(edge: { source: string; sourceHandle?: string | null }): ConnectorType | null {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) {
      return null;
    }
    return portOfOutputHandle(edge.sourceHandle) ?? (source.type === 'audio' ? 'audios' : portsOfTile(source).output);
  }

  function audioInputOfTile(n: Tile): AudioInputKind {
    const wired = edges.filter((e) => e.target === n.id).map(wiredPortOf);
    return audioInputKindOf(wired.filter((port): port is ConnectorType => port !== null));
  }

  const NAMED_OUTPUTS: Partial<Record<string, (n: Tile) => SelectOutput[]>> = {
    audio: (n) => audioNamedOutputs(audioOperationOfTile(n), audioInputOfTile(n)),
    social_account_feed: () => sourceOutputs('social_account_feed')
  };

  function outputsOfTile(n: Tile): SelectOutput[] {
    return (NAMED_OUTPUTS[n.type] ?? selectOutputsOf)(n);
  }

  function audioUrlsOf(n: Tile): { videoUrl: string | null; audioUrl: string | null } {
    const { videoId, audioId } = audioOutputIds(n.data);
    return { videoUrl: assetUrl(videoId), audioUrl: assetUrl(audioId) };
  }

  function audioFilesOf(n: Tile, language: string | null) {
    return audioNodeFiles({ ...audioUrlsOf(n), nodeId: n.id, displayName: n.displayName, language });
  }

  function portsOfTile(n: Tile): { inputs: ConnectorType[] | undefined; output: ConnectorType | null } {
    if (!isNodeType(n.type)) {
      return { inputs: undefined, output: null };
    }
    const model = typeof n.data.model === 'string' ? n.data.model : null;
    return portsOf(n.type, {
      modelPorts: () => connectorsForNode(n.type as GenerativeNodeKind, model, catalogue[n.type as GenerativeNodeKind] ?? []),
      listPorts: () => listPortsByNode[n.id] ?? [],
      itemPort: () => itemPortOf(n.type === 'list' ? listValuesByNode[n.id]?.itemKind : upstreamListOf(n.id)?.itemKind),
      mediaKind: () => upstreamEffectsMediaOf(n.id)?.kind ?? (n.data.mediaKind === 'video' ? 'video' : 'image'),
      audioOperation: () => audioOperationOfTile(n),
      audioInput: () => audioInputOfTile(n)
    });
  }

  /**
   * Quel che `CanvasFlow` disegna. `node` è ciò che serve a dire NO a un arco prima che nasca:
   * senza, `verdictBetween` non sa che tipo sia una tile e — per la sua regola, che è giusta —
   * lascia passare tutto.
   */
  function tileHeight(n: Tile): number {
    if (n.id === inlineMotion) {
      return frameFit(n.id, n.w, NodeMode.Edit)?.h ?? n.h;
    }
    if (n.type !== 'text' || !(n.id in grownHeights)) return n.h;
    return grownTextNodeHeight(grownHeights[n.id], n.userHeight);
  }

  const tiles = $derived(
    nodes.map((n) => ({ n, chrome: tileChromeOf(n), ports: portsOfTile(n), outputs: outputsOfTile(n) })).map(({ n, chrome, ports, outputs }) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      w: n.w,
      h: tileHeight(n),
      connectable: chrome.ports,
      connectors: chrome.ports ? ports.inputs : [],
      output: !chrome.ports || outputs.some((o) => !o.custom) ? null : ports.output,
      outputs: chrome.ports ? outputs : [],
      kind: n.type,
      displayName: n.displayName,
      tag: chrome.label ? NameTag.Shown : NameTag.Hidden,
      rotation: layoutOf(n.data).rotation,
      rotatable: motionOf(n)?.kind === FrameKind.Group,
      behind: chrome.behind,
      members: chrome.behind ? nodes.filter((m) => layoutOf(m.data).groupId === n.id).map((m) => m.id) : undefined,
      inPost: data.nodeIdsInPost.includes(n.id),
      select: n.select,
      settings: hasInspector(n.type),
      poster: tilePoster(n) ?? undefined,
      minW: nodeSize(n.type, n.data).w,
      minH: nodeSize(n.type, n.data).h,
      node: n.type === 'effects'
        ? { id: n.id, kind: 'effects' as const, mediaKind: n.data.mediaKind === 'video' ? 'video' as const : 'image' as const }
        : tileNode({
        id: n.id,
        medium: n.type === 'iframe' || n.type === 'document' || n.type === 'doc' ? null : (n.type as 'text' | 'image' | 'video' | 'audio' | 'list' | 'select' | 'products' | 'social_account_feed'),
        model: typeof n.data.model === 'string' ? n.data.model : null,
        uncensored: uncensoredModelOf(n),
        operation: n.type === 'audio' ? audioOperationOfTile(n) : undefined
      })
    }))
  );

  /** `type`/`data` grezzi di ogni tile — la forma che `commonPropertiesOf` legge, per la barra
   *  della selezione: `tiles` porta già `node: CanvasNode`, un'astrazione diversa che non ha
   *  `model`/`params` come campi diretti. */
  function sourceThumbs(id: string): string[] {
    const items = [...(shownPosts[id] ?? []).map(postThumb), ...(shownProducts[id] ?? []).map(productThumb), ...(influencersByNode[id]?.views ?? []).map((v) => v.url)];
    return items.filter((url): url is string => !!url);
  }

  let domReason = $state<string | null>(rendererOf(page.url, data.rendererSwitch) === Renderer.Dom ? (data.rendererSwitch === Switch.ForceDom ? 'kill switch' : '?renderer=dom') : null);
  let Flow = $state<typeof GpuFlow | null>(rendererOf(page.url, data.rendererSwitch) === Renderer.Gpu ? null : (CanvasFlow as unknown as typeof GpuFlow));
  $effect(() => {
    if (Flow) {
      return;
    }
    void import('$lib/components/canvas/gpu/GpuFlow.svelte').then((m) => (Flow = m.default));
  });

  const nodeSummaries = $derived(nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })));

  const DYNAMIC_PARAM_TYPES: ReadonlySet<string> = new Set<GenMedium>(['image', 'video', 'model3d']);

  function modelChoicesFor(type: GenPropertyType): ModelChoice[] {
    return catalogue[type] ?? [];
  }

  let failed = $state<string | null>(null);
  let failedIsCreditsExhausted = $state(false);
  let peers = $state<PresencePeer[]>([]);
  let topPeers = $state<HTMLElement | null>(null);
  $effect(() => {
    topPeers = document.querySelector<HTMLElement>('[data-top-peers]');
  });
  const frames = frameHub({ userId: data.session?.user?.id ?? '', name: displayName(data.session?.user?.email ?? 'User') });
  provideFramePresence(frames.port);
  const cursorSession = crypto.randomUUID();
  const cursors = canvasHub({ sessionId: cursorSession, userId: data.session?.user?.id ?? '', name: displayName(data.session?.user?.email ?? 'User') });
  const commits = commitHub(cursorSession);
  const PEER_SWEEP_MS = 1000;
  let cursorMarks = $state(new Map<string, HeldMark>());
  let presenceNow = $state(0);
  const peerPaths = peerTracks();
  let peerFrame = $state(0);
  let peerFrameId = 0;
  function wakePeerFrames() {
    if (peerFrameId) { return; }
    const step = () => {
      peerFrame = Date.now();
      peerFrameId = peerPaths.moving(peerFrame) ? requestAnimationFrame(step) : 0;
    };
    peerFrameId = requestAnimationFrame(step);
  }
  const canvasPeers = $derived(canvasPeersOf(cursorMarks, cursorSession, presenceNow, (box) => tiles.some((t) => t.id === box.id && landedAt(t, box))));
  const drawnPeers = $derived(peerFrame ? peerPaths.smooth(canvasPeers, peerFrame) : canvasPeers);
  let following = $state<string | null>(null);
  let presenting = $state(false);
  const followView = $derived(following ? followed(canvasPeers, following) : null);
  const presenter = $derived(presenterOf(canvasPeers));
  function spotlight(on: boolean) {
    presenting = on;
    cursors.port.update({ presenting: on });
  }
  $effect(() => {
    const unlisten = cursors.port.listen((mark, sentAt) => {
      cursorMarks = keepCanvasMark(untrack(() => cursorMarks), mark);
      presenceNow = Date.now();
      peerPaths.heard(mark, sentAt, presenceNow);
      if (document.visibilityState === 'hidden') { peerFrame = 0; return; }
      wakePeerFrames();
    });
    const sweep = setInterval(() => { presenceNow = Date.now(); }, PEER_SWEEP_MS);
    return () => { unlisten(); clearInterval(sweep); cursors.port.stop(); };
  });
  let pending = 0;
  let snapshotMissed = false;
  let snapshotVersion = 0;
  const SAVE_DEBOUNCE_MS = 400;
  const SAVE_MAX_WAIT_MS = 2000;
  const SAVE_BACKOFF_CAP_MS = 30000;
  const REMOTE_REFRESH_MS = 250;
  const WARM_AFTER_MS = 500;
  const WARM_ON_LOAD = 6;
  let saveStatus = $state(SaveStatus.Saved);
  let placeStatus = $state(SaveStatus.Saved);
  let unsentCount = $state(0);
  let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  const syncShown = $derived(syncOf({ nodes: saveStatus, places: placeStatus, unsent: unsentCount, online }));
  const OFFLINE_RUN_NOTICE = 'Offline: generating needs a connection. Your edits are kept and will save when you are back.';
  const LINE_REFUSED_NOTICE = 'A line change was refused by the canvas and was undone.';
  let outbox: Outbox | null = null;
  const saves = createSaveScheduler({
    send: sendSave,
    debounceMs: SAVE_DEBOUNCE_MS,
    maxWaitMs: SAVE_MAX_WAIT_MS,
    backoffMs: (failures) => Math.min(SAVE_BACKOFF_CAP_MS, 1000 * 2 ** (failures - 1)),
    onStatus: (status) => { saveStatus = status; keepOutbox(); }
  });

  const places = createPlaceSaves({
    send,
    backoffMs: (failures) => Math.min(SAVE_BACKOFF_CAP_MS, 1000 * 2 ** (failures - 1)),
    onStatus: (status) => { placeStatus = status; keepOutbox(); },
    announce: { intent: (row) => commits.publish([row]), refused: () => commits.publish([]) }
  });

  const lines = createOpQueue({
    send: async (op) => {
      const answer = await send(op.action, op.fields);
      return answer.type === 'success' ? SendResult.Saved : sendResultOf(failureOf(answer));
    },
    store: { save: (ops) => { void outbox?.save({ ops }); countUnsent(); } },
    backoffMs: (failures) => Math.min(SAVE_BACKOFF_CAP_MS, 1000 * 2 ** (failures - 1)),
    onDropped: () => { failed = LINE_REFUSED_NOTICE; refreshSoon(); }
  });

  function countUnsent() {
    unsentCount = Object.keys(saves.unsentPatches()).length + places.unsentEntries().length + lines.size();
  }

  function keepOutbox() {
    countUnsent();
    void outbox?.save({ nodes: saves.unsentPatches(), places: places.unsentEntries() });
  }

  async function reopenOutbox(key: string) {
    const opened = await openOutbox(idbShelf(), key);
    outbox = opened;
    for (const [id, patch] of Object.entries(opened.nodes)) {
      if (nodes.some((node) => node.id === id)) {
        void write(id, patch, SaveTiming.Now);
      }
    }
    places.restore(opened.places);
    lines.restore(opened.ops);
    keepOutbox();
  }

  $effect(() => {
    const user = data.session?.user?.id;
    if (!user || typeof indexedDB === 'undefined') {
      return;
    }
    void untrack(() => reopenOutbox(`${user}:${data.canvas.id}`));
  });

  $effect(() => {
    const on = () => { online = true; };
    const off = () => { online = false; };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  });

  /**
   * LO STACK DI QUESTA SCHEDA — non dell'utente, non del database: `undo-stack.ts` lo dice in
   * testa al file, e vale anche qui. Un gesto entra dopo che il server l'ha già scritto (mai
   * prima: annullare un gesto che il server ha rifiutato annullerebbe qualcosa che non è mai
   * successo), con l'inversa già in mano — `before`/`after` che il server ha appena restituito, o
   * che il client teneva già per costruire la richiesta.
   *
   * `StackEntry` PORTA I DUE MONDI: un `Gesture` che passa dal server (`undo`, sotto) e un
   * `MoveGesture` che non lo tocca mai — la posizione è last-write-wins, senza `canvas_events`, e
   * la sua domanda ("è ancora dov'era?") è `checkMoveGesture`, non `checkGesture`. Un'unica
   * cronologia, non due stack separati: creare un nodo dopo averne spostato un altro e poi
   * annullare due volte deve disfare la creazione e poi lo spostamento, nell'ordine vero.
   */
  type StackEntry = { source: 'server'; gesture: Gesture } | { source: 'move'; gesture: MoveGesture } | { source: 'turn'; turn: Turn };
  const undoStack = createUndoStack<StackEntry>();

  /** Ogni scrittura che passa da `undo` (server) spinge qui, mai `undoStack.push` diretto — la
   *  busta `{ source: 'server', … }` sta in un posto solo. */
  function pushGesture(gesture: Gesture) {
    undoStack.push({ source: 'server', gesture });
  }

  let productsOverride = $state<Record<string, Product[]> | null>(null);
  let socialPostsOverride = $state<Record<string, SocialPost[]> | null>(null);
  const products = $derived(productsOverride ?? productsByNode);
  const socialPosts = $derived(socialPostsOverride ?? socialPostsByNode);
  const shownProducts = $derived(
    Object.fromEntries(
      nodes.filter((n) => n.type === 'products').map((n) => [n.id, filterProducts(products[n.id] ?? [], productFiltersOf(n.data.filters))])
    ) as Record<string, Product[]>
  );
  const shownPosts = $derived(
    Object.fromEntries(
      nodes
        .filter((n) => n.type === 'social_account_feed')
        .map((n) => [n.id, filterPosts(socialPosts[n.id] ?? [], feedFiltersOf(n.data.filters))])
    ) as Record<string, SocialPost[]>
  );

  let selectedIds = $state<string[]>([]);

  function selectionChanged(ids: string[]) {
    if (ids.join() !== untrack(() => selectedIds.join())) { void saves.flush(); }
    const before = untrack(() => inlineMotion);
    selectedIds = ids;
    cursors.port.update({ selection: ids });
    leaveNow(before);
  }

  function leaveNow(before: string | null) {
    const after = untrack(() => inlineMotion);
    if (before && before !== after) {
      inlineStage.leave(before);
    }
  }

  const liveHost = $derived(domReason ? LiveHost.Node : LiveHost.Canvas);

  let dismissedMotion = $state<string | null>(null);
  let requestedMotion = $state<string | null>(null);
  let pageWidth = $state(0);
  const opening = $derived(openingOf(viewportOf(pageWidth)));
  const openingHere = $derived.by(() => {
    const row = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : null;
    return row ? openingFor(row, opening) : opening;
  });
  const inlineMotion = $derived(inlineMotionTarget(selectedIds, nodes, dismissedMotion, openingHere, requestedMotion));
  const editingMotion = $derived(editorOn(inlineMotion, inlineStage.leaving));
  let lastOpen: string | null = null;

  $effect(() => {
    const open = inlineMotion;
    const closed = lastOpen;
    lastOpen = open;
    untrack(() => {
      if (open && open === inlineStage.leaving) {
        inlineStage.landed(open);
      }
      if (closed && closed !== open && nodes.some((n) => n.id === closed)) {
        inlineStage.leave(closed);
      }
    });
  });

  $effect(() => {
    if (selectedIds.length !== 1 || selectedIds[0] !== untrack(() => dismissedMotion)) {
      dismissedMotion = null;
    }
    if (selectedIds.length !== 1 || selectedIds[0] !== untrack(() => requestedMotion)) {
      requestedMotion = null;
    }
  });

  $effect(() => {
    const [id] = selectedIds;
    if (selectedIds.length === 1 && untrack(() => nodes.find((n) => n.id === id))?.type === 'motion') {
      prefetchSession(motionEditorPath({ projectId: data.projectId, canvasId: data.canvas.id, nodeId: id }));
    }
  });

  function headRevisionOf(id: string): number {
    const row = nodes.find((n) => n.id === id);
    return row && row.type === 'motion' ? (motionOf(row)?.docHeadRevision ?? 0) : 0;
  }

  function warmMotion(id: string) {
    if (!nodes.some((n) => n.id === id && n.version > 0)) {
      return;
    }
    prefetchSession(motionEditorPath({ projectId: data.projectId, canvasId: data.canvas.id, nodeId: id }));
  }

  function warmHovered(e: PointerEvent) {
    const id = (e.target as Element | null)?.closest?.('[data-motion-node]')?.getAttribute('data-motion-node');
    if (id) {
      warmMotion(id);
    }
  }

  const motionIds = $derived(nodes.filter((n) => n.type === 'motion').slice(0, WARM_ON_LOAD).map((n) => n.id).join());

  $effect(() => {
    const ids = motionIds.split(',').filter(Boolean);
    const timer = setTimeout(() => ids.forEach(warmMotion), WARM_AFTER_MS);
    return () => clearTimeout(timer);
  });

  function reframe(id: string | null, free: Insets) {
    const row = id ? nodes.find((n) => n.id === id) : null;
    if (id && reframesOn(viewportOf(pageWidth)) === Reframe.Frame) {
      focusOn([id], free, row && !tileChromeOf(row).bar ? FocusMode.Reveal : FocusMode.Frame);
    }
  }

  function requestMotion(id: string) {
    dismissedMotion = null;
    requestedMotion = id;
  }

  $effect(() => {
    canvasSelection.set(selectedIds);
    return () => canvasSelection.set([]);
  });

  $effect(() => {
    propertiesTarget.set(targetOf(selectedIds, nodes));
    return () => propertiesTarget.set(null);
  });

  $effect(() => {
    if ($propertiesRequest) {
      requestMotion($propertiesRequest);
    }
  });

  let seenRevision = '';
  let reloadOffered = $state(false);

  function dropOrphans(fresh: CanvasNodeRecord[]) {
    const dropped = orphanedEdits(nodes, fresh, saves.dirtyKeys);
    for (const id of dropped) {
      saves.discard(id);
    }
    if (dropped.length) {
      failed = DROPPED_EDIT_NOTICE;
    }
  }

  async function refresh(): Promise<boolean> {
    const version = ++snapshotVersion;
    const snapshot = await post('snapshot', {});
    if (!snapshot) {
      return false;
    }
    seenRevision = String(snapshot.revision ?? '');
    dropOrphans(snapshot.nodes as CanvasNodeRecord[]);
    runsOverride = keepSame(runs, (snapshot.runs ?? {}) as Record<string, unknown[]>, Date.now());
    if (pending || version !== snapshotVersion) {
      nodes = adoptIdleRows(nodes, snapshot.nodes as CanvasNodeRecord[], saves.dirtyKeys);
      snapshotMissed = true;
      return true;
    }
    const now = Date.now();
    const before = nodes;
    nodes = keepSame(nodes, keepPending((snapshot.nodes as CanvasNodeRecord[]).map((n) => toTile(n)), nodes, saves.dirtyKeys, places.dirty), now);
    edges = keepSame(edges, keepLines((snapshot.connections as Connection[]).map(toEdge), edges, lines.pending()), now);
    productsOverride = keepSame(products, (snapshot.products ?? {}) as Record<string, Product[]>, now);
    socialPostsOverride = keepSame(socialPosts, (snapshot.socialPosts ?? {}) as Record<string, SocialPost[]>, now);
    influencersOverride = keepSame(influencersByNode, (snapshot.influencers ?? {}) as Record<string, InfluencerTile>, now);
    return changedElsewhere(before, nodes);
  }

  function leave(path: string, notice: string | null) {
    carryNotice(notice);
    void goto(path, { invalidateAll: true });
  }

  const REACTIONS: Record<Verdict, () => Promise<void> | void> = {
    [Verdict.Resync]: async () => {
      void invalidate(CANVAS_LIST_DEPENDENCY);
      const notice = VERDICT_NOTICE[Verdict.Resync];
      if (await refresh() && notice) {
        failed = notice;
      }
    },
    [Verdict.LeaveCanvas]: () => leave(`/p/${data.projectId}`, VERDICT_NOTICE[Verdict.LeaveCanvas]),
    [Verdict.LeaveProject]: () => leave(HOME_PATH, VERDICT_NOTICE[Verdict.LeaveProject]),
    [Verdict.OfferReload]: () => { reloadOffered = true; }
  };

  async function checkStale(trigger: Trigger) {
    const remote = (await post('revision', {})) as RemoteState | null;
    if (!remote) {
      return;
    }
    for (const verdict of judge({ seen: seenRevision, remote, trigger, appUpdated: updated.current })) {
      await REACTIONS[verdict]();
    }
  }

  const canvasLoad = $derived(data.nodes);

  $effect(() => {
    const loaded = canvasLoad;
    return untrack(() => openCanvas(loaded as CanvasNodeRecord[]));
  });

  function openCanvas(loaded: CanvasNodeRecord[]) {
    snapshotVersion += 1;
    runsOverride = null;
    nodes = keepPending(loaded.map((n) => toTile(n)), nodes, saves.dirtyKeys, places.dirty);
    edges = (data.connections as Connection[]).map(toEdge);
    seenRevision = data.revision;
    const carried = takeNotice();
    if (carried) {
      failed = carried;
    }
    const user = data.session?.user;
    if (!user) { return; }
    const disconnect = connectCanvas({
      client: createSupabaseBrowserClient(),
      canvasId: data.canvas.id,
      projectId: data.projectId,
      peer: { userId: user.id, name: user.email ?? 'User', avatar: null,
        path: `/p/${data.projectId}/c/${data.canvas.id}`, threadId: null },
      onChange: (change) => {
        if (isOwnEcho(change, nodes)) { return; }
        const moved = adoptFrameHead(change, nodes, saves.dirtyKeys);
        if (moved) { nodes = moved; return; }
        refreshSoon();
      },
      onReconnect: () => { void checkStale(Trigger.Reconnect); },
      onCanvasList: () => { void invalidate(CANVAS_LIST_DEPENDENCY); },
      onPeers: (value) => { peers = value; cursors.port.crowd(value.length + 1); },
      onLink: (state) => { canvasLink.set(state); },
      frames: frames.line,
      frameHeads: frames.heads,
      cursors: cursors.line,
      commits: commits.line
    });
    const unheard = commits.listen((note) => {
      const adopted = adoptCommitted(nodes, note.rows, saves.dirtyKeys, places.dirty);
      nodes = adopted.tiles;
      if (adopted.refetch) { void refresh(); }
    });
    return () => {
      unheard();
      disconnect();
      canvasLink.set(null);
    };
  }

  $effect(() => onCanvasReveal((trigger) => { void checkStale(trigger); }));

  $effect(() => {
    if (updated.current) {
      void untrack(() => checkStale(Trigger.AppUpdated));
    }
  });

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  function retryMissed() {
    if (pending || !snapshotMissed) { return; }
    snapshotMissed = false;
    refreshSoon();
  }

  function refreshSoon() {
    if (refreshTimer) { clearTimeout(refreshTimer); }
    refreshTimer = setTimeout(() => { refreshTimer = null; void refresh(); }, REMOTE_REFRESH_MS);
  }

  $effect(() => {
    const flushAll = () => { void saves.flush(); void places.flush(); void lines.drain(); };
    const flushHidden = () => { if (document.visibilityState === 'hidden') { flushAll(); } };
    const warnUnsent = (event: BeforeUnloadEvent) => {
      if (!saves.unsent() && !places.unsent() && !lines.size()) { return; }
      flushAll();
      event.preventDefault();
    };
    document.addEventListener('focusout', flushAll);
    document.addEventListener('visibilitychange', flushHidden);
    window.addEventListener('pagehide', flushAll);
    window.addEventListener('beforeunload', warnUnsent);
    return () => {
      document.removeEventListener('focusout', flushAll);
      document.removeEventListener('visibilitychange', flushHidden);
      window.removeEventListener('pagehide', flushAll);
      window.removeEventListener('beforeunload', warnUnsent);
    };
  });

  beforeNavigate(() => { void saves.flush(); void places.flush(); });

  function formOf(fields: Record<string, string | number | File | string[]>): FormData {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) {
        for (const item of value) { body.append(key, item); }
        continue;
      }
      body.set(key, value instanceof File ? value : String(value));
    }
    return body;
  }

  function announceCommit(action: string, fields: Record<string, unknown>, answer: ActionAnswer) {
    if (answer.type !== 'success') { return; }
    const rows = rowsOf(action, fields, (answer.data ?? {}) as Record<string, unknown>);
    if (rows) { commits.publish(rows); }
  }

  async function send(
    action: string,
    fields: Record<string, string | number | File | string[]>
  ): Promise<ActionAnswer> {
    let res: Response;
    try {
      res = await fetch(canvasActionUrl({ projectId: data.projectId, canvasId: data.canvas.id }, action), {
        method: 'POST',
        headers: { 'x-sveltekit-action': 'true' },
        body: formOf(fields)
      });
    } catch (cause) {
      console.warn(`canvas action ${action}: network`, cause);
      return { type: 'network' };
    }

    const text = await res.text();
    try {
      const answer = deserialize(text) as ActionAnswer;
      announceCommit(action, fields, answer);
      return answer;
    } catch {
      console.warn(`canvas action ${action}: unreadable ${res.status}`, text.slice(0, 500));
      return { type: 'error', status: res.status };
    }
  }

  function announce(action: string, reason: SaveFailure, detail: unknown) {
    console.warn(`canvas action ${action} failed: ${reason}`, detail);
    failedIsCreditsExhausted = reason === SaveFailure.Credits;
    failed = saveMessage(reason, (detail ?? {}) as { message?: string });
  }

  function report(action: string, result: ActionAnswer) {
    if (saveBanner(action, result) === null) {
      console.warn(`canvas read ${action} failed: ${failureOf(result)}`, result.data ?? result);
      return;
    }
    announce(action, failureOf(result), result.data ?? result);
  }

  type Fields = Record<string, string | number | File | string[]>;

  function post(action: string, fields: Fields): Promise<Record<string, unknown> | null> {
    return answered(action, () => send(action, fields));
  }

  function postAtVersion(action: string, id: string, fields: Fields): Promise<Record<string, unknown> | null> {
    let release = () => {};
    const asked = actAtVersion({
      settle: async () => { await saves.flush(id); release = saves.hold(id); },
      version: () => nodes.find((node) => node.id === id)?.version ?? 0,
      send: (version) => send(action, { ...fields, node_id: id, version }),
      reread: refresh
    });
    return answered(action, () => asked).finally(() => release());
  }

  async function answered(action: string, ask: () => Promise<ActionAnswer>): Promise<Record<string, unknown> | null> {
    const mutating = actionKind(action) === ActionKind.Write;
    if (mutating) { pending += 1; snapshotVersion += 1; }
    try {
      const result = await ask();
      if (result.type !== 'success') {
        report(action, result);
        return null;
      }

      if (mutating) { failed = null; failedIsCreditsExhausted = false; }
      return (result.data ?? null) as Record<string, unknown> | null;
    } finally {
      if (mutating) { pending -= 1; snapshotVersion += 1; retryMissed(); }
    }
  }

  /**
   * UN FILE VA DRITTO NELLO STORAGE DAL BROWSER, e solo il percorso arriva al server: lo stesso
   * schema di `StudioPage.svelte::handleImageUpload`, per la stessa ragione — un video o un
   * documento normale supera facilmente il corpo che un'azione SvelteKit regge su Vercel.
   *
   * Il nodo nasce SOLO quando la riga torna, come `create`: niente tile senza riga dietro.
   */
  const supabase = createSupabaseBrowserClient();

  async function upload(file: File) {
    const verdict = verdictForUpload(file.type, file.name, file.size);
    if (!verdict.ok) {
      failed = verdict.why;
      return;
    }

    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage
      .from('canvas-assets')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) {
      failed = up.error.message;
      return;
    }

    const result = await post('upload', {
      path, file_name: file.name, mime_type: file.type, bytes: file.size, x: 0, y: 0
    });
    const created = result?.node as CanvasNodeRecord | undefined;
    if (created) { nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })]; }
  }

  const RENDER_VIEW_GAP = 24;

  async function renderModelViews(id: string, views: Blob[]) {
    const source = nodes.find((node) => node.id === id);
    if (!source) {
      return;
    }
    const right = source.x + source.w + RENDER_VIEW_GAP;
    const tile = genNodeSize('image');
    await Promise.all(
      views.map(async (view, i) => {
        const name = `${RENDER_VIEWS[i]?.name ?? i}-view.png`;
        const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${name}`;
        const up = await supabase.storage.from('canvas-assets').upload(path, view, { contentType: view.type, upsert: false });
        if (up.error) {
          failed = up.error.message;
          return;
        }
        const result = await post('upload', {
          path, file_name: name, mime_type: view.type, bytes: view.size,
          x: right + i * (tile.w + RENDER_VIEW_GAP), y: source.y
        });
        const created = result?.node as CanvasNodeRecord | undefined;
        if (created) { nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created)]; }
      })
    );
  }

  async function uploadToLibrary(file: File): Promise<string | null> {
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      failed = up.error.message;
      return null;
    }

    const result = await post('upload', {
      path, file_name: file.name, mime_type: file.type, bytes: file.size, into: 'library'
    });
    const asset = result?.asset as { id?: string } | undefined;
    return asset?.id ?? null;
  }

  let componentPickFor = $state<string | null>(null);
  const componentItems = $derived(componentCatalogue(data.componentTemplates));
  const componentPicking = $derived.by(() => {
    const row = componentPickFor ? nodes.find((n) => n.id === componentPickFor) : null;
    return row ? compositionOf(row) : null;
  });

  function componentDraft(nodeId: string, templateId: string, format: MotionFormat): Instance | null {
    const entry = data.componentTemplates.find((t) => t.id === templateId);
    const made = entry ? composedTemplate(entry, { format, values: {} }, compositionCards(nodeId, edges, nodes), sequentialIds()) : null;
    return made?.ok ? made : null;
  }

  let frameLibraryAt = $state<{ x: number; y: number } | null>(null);
  const catalogPosters = new SvelteMap<string, string>();
  let frameMedia = $state<LibraryMedia[]>([]);
  const frameMediaUrls = $derived(Object.fromEntries(frameMedia.map((m) => [m.id, m.url ?? m.previewUrl])));
  const uploadToFrameLibrary = canvasMediaUploader(supabase, { orgId: data.orgId, projectId: data.projectId, canvasId: data.canvas.id });
  const uploadFrameMedia: MediaUploader = async (file, progress) => {
    const outcome = await uploadToFrameLibrary(file, progress);
    if (outcome.ok) {
      frameMedia = [outcome.asset, ...frameMedia.filter((m) => m.id !== outcome.asset.id)];
    }
    return outcome;
  };

  $effect(() => {
    if (frameLibraryAt) {
      void projectMedia({ projectId: data.projectId, canvasId: data.canvas.id }).then((media) => (frameMedia = media));
    }
  });

  function frameValues(templateId: string, draft: Instance | null): Record<string, string> {
    const fresh = draft ? frameDraft(templateId, formatOf(draft.doc)) : null;
    return draft && fresh ? changedRaw(templateFields(fresh.doc, fresh.clipId), templateFields(draft.doc, draft.clipId)) : {};
  }

  function frameDraft(templateId: string, format: MotionFormat): Instance | null {
    const entry = data.componentTemplates.find((t) => t.id === templateId);
    const made = entry ? composedTemplate(entry, { format, values: {} }, [], sequentialIds()) : null;
    return made?.ok ? made : null;
  }

  async function addFrame(templateId: string, draft: Instance | null) {
    const at = frameLibraryAt;
    frameLibraryAt = null;
    if (!at) {
      return;
    }
    const item = componentItems.find((i) => i.id === templateId);
    const doc = (draft ?? (item ? frameDraft(templateId, libraryFormat(item, MotionFormat.Landscape)) : null))?.doc;
    if (!doc) {
      return;
    }

    const probe = pendingFrame(at, doc);
    const frameSize = { w: probe.size.width ?? 0, h: probe.size.height ?? 0 };
    const spot = placeNear(at, frameSize, occupiedRects());
    const id = crypto.randomUUID();
    const name = data.componentTemplates.find((t) => t.id === templateId)?.template.name ?? null;
    const values = frameValues(templateId, draft);
    const poster = Object.keys(values).length ? null : item?.preview?.poster;
    if (poster) {
      catalogPosters.set(id, poster);
    }
    nodes = [...nodes, toTile(placedFrame({ id, canvasId: data.canvas.id, projectId: data.projectId, name, at: spot, doc }))];
    const result = await post('frame_template', { template: templateId, format: formatOf(doc), values: JSON.stringify(values), x: spot.x, y: spot.y, node_id: id });
    const node = result?.node as CanvasNodeRecord | undefined;
    nodes = settle(nodes, id, node ? toTile(node) : null);
    if (!node) {
      catalogPosters.delete(id);
    }
    if (node && offCentre(at, spot, frameSize)) {
      focusOn([node.id]);
    }
  }

  function pickComponent(nodeId: string, templateId: string, draft: Instance | null) {
    componentPickFor = null;
    write(nodeId, { template: { id: templateId, values: draft ? editedValues(draft) : {} }, ...(draft ? { aspect: aspectOf(draft.doc) } : {}) }, SaveTiming.Now);
  }

  let effectsEditorId = $state<string | null>(null);
  const effectsEditing = $derived.by(() => {
    const row = effectsEditorId ? nodes.find((n) => n.id === effectsEditorId) : null;
    return row ? effectsOf(row) : null;
  });

  async function applyEffects(id: string, steps: EffectStep[], _output: Blob | null = null): Promise<boolean> {
    const source = upstreamEffectsMediaOf(id);
    if (!source) {
      return false;
    }

    const current = effectsEditing;
    if (!current) {
      return false;
    }
    const saved = await write(id, effectsData({ ...current, effects: steps, sourceRefId: source.refId, mediaKind: source.kind }), SaveTiming.Now);
    if (!saved) {
      return false;
    }

    const result = await post('apply_effects', { node_id: id });
    const written = result?.node as CanvasNodeRecord | undefined;
    if (!written) {
      return false;
    }
    nodes = nodes.map((node) => node.id === id ? toTile(written) : node);
    return true;
  }

  async function makePair(id: string) {
    const res = await post('effects_pair', { node_id: id });
    const created = (res?.node ?? null) as CanvasNodeRecord | null;
    const wire = (res?.connection ?? null) as Connection | null;
    if (!created) {
      return;
    }

    nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })];
    edges = wire ? [...edges.filter((edge) => edge.id !== wire.id), toEdge(wire)] : edges;
    pushGesture(createManyGesture([created], wire ? [wire] : []));
  }

  function occupiedRects(): Rect[] {
    return tiles.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  }

  function sizeForAddable(what: Addable): { w: number; h: number } {
    return nodeSize(what);
  }

  /** Un `node.create` di un nodo appena nato: l'inversa è un soft-delete, `checkGesture` la sa già. */
  function createGesture(node: CanvasNodeRecord): Gesture {
    return { items: [{ kind: 'node.create', nodeId: node.id, after: { type: node.type, position: node.position, data: node.data } }] };
  }

  async function create(what: Addable, at: { x: number; y: number }) {
    const size = sizeForAddable(what);
    const spot = placeNear(at, size, occupiedRects());

    const res = await post('create', {
      type: what,
      x: spot.x,
      y: spot.y,
      data: JSON.stringify(newNodeRow(what))
    });

    const created = (res?.node ?? null) as CanvasNodeRecord | null;
    if (!created) {
      return;
    }

    nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })];
    pushGesture(createGesture(created));
    if (offCentre(at, spot, size)) {
      focusOn([created.id]);
    }
    if (created.type === 'influencer') {
      void refresh();
    }
  }

  /**
   * UN NODO CHE NASCE GIÀ PIENO — trascinato dalla libreria degli asset o dai brand, non dal menù
   * del doppio clic. Stessa forma di `create`, ma `type`/`data` arrivano dal trascinamento e non
   * da `newNodeRow`: il server li rivalida comunque (`validateNodeData`), perché un payload che
   * viaggia nel `dataTransfer` del browser non è meno un input esterno di un form.
   */
  async function createFilled(drag: FilledNodeDrag, at: { x: number; y: number }) {
    const res = await post('create', {
      type: drag.type,
      x: at.x - drag.w / 2,
      y: at.y - drag.h / 2,
      data: JSON.stringify(drag.data)
    });

    const created = (res?.node ?? null) as CanvasNodeRecord | null;
    if (!created) {
      return;
    }

    nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })];
    pushGesture(createGesture(created));
  }

  /**
   * SPOSTARE SI SCRIVE ALLA FINE DEL GESTO, non durante: `CanvasFlow` chiama qui su
   * `onNodeDragStop`, quindi un trascinamento è un `UPDATE` e non uno per fotogramma. Lo schermo
   * è già andato avanti da solo — la libreria muove il nodo mentre lo si trascina — e questa riga
   * porta la posizione dove vive davvero.
   */
  /**
   * FAR GIRARE UN NODO. `running` si accende SUBITO, prima di qualunque `await`: lo spinner non
   * deve aspettare un salvataggio precedente (un carattere digitato prima del clic, ancora in
   * coda) né la risposta del server. Il bottone si spegne di conseguenza (`canStartRun`).
   *
   * `enqueue` resta prima di leggere `before` e mandare la POST vera: scegliere un modello scrive
   * (`write`, sopra) e quella scrittura aggiorna `nodes[].version` in locale solo quando il
   * server risponde — scegliere e premere Genera di seguito, senza la pausa di una mano vera fra
   * i due gesti, altrimenti legge la versione di prima del giro e il server risponde 409 su un
   * prompt mai partito. Passare per la stessa coda del nodo mette la POST in fila dietro quella
   * scrittura invece di correrci contro — ma questo riguarda solo la POST, non lo spinner.
   */
  function runQuoteFor(ids: string[]): RunQuote | null {
    const row = ids.length === 1 ? nodes.find((n) => n.id === ids[0]) : undefined;
    const gen = row ? genOf(row) : null;
    if (!row || !gen) {
      return null;
    }

    const revision = textEstimateRevision(row.id);
    const estimate = textCostEstimates[row.id]?.revision === revision ? textCostEstimates[row.id] : undefined;
    const catalogueEntry = mediumCatalogue[gen.medium];

    return runQuoteOf({
      node: { ...gen, runs: runsByNode[row.id] ?? [] },
      choices: catalogueEntry.choices,
      hasUpstreamText: hasUpstreamTextByNode[row.id] ?? false,
      variableTextInput: estimate?.variableInput ?? (gen.medium === 'text' && revision !== '[]'),
      enhanceUnitCredits: catalogueEntry.enhanceUnitCredits,
      estimatedTextInputTokens: estimate?.inputTokens,
      estimatedTextOutputTokens: estimate?.outputTokens,
      hasUpstreamImage: edges.some((e) => e.target === row.id && e.targetHandle === 'images'),
      imageChoices: catalogue.image
    });
  }

  function runNode(id: string) {
    const row = nodes.find((n) => n.id === id);
    const gen = row ? genOf(row) : null;
    if (gen) {
      void run(id, gen);
    }
  }

  async function run(id: string, gen: GenNodeState) {
    if (gen.running) {
      return;
    }
    if (!online) {
      failed = OFFLINE_RUN_NOTICE;
      return;
    }

    nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...genData(startRun(gen)) } } : node));

    pending += 1;
    const result = await postAtVersion('run', id, {
      medium: gen.medium,
      prompt: gen.prompt,
      model: effectiveModel(gen.medium, gen.model, catalogue[gen.medium] ?? []) ?? '',
      params: JSON.stringify(gen.params)
    });
    pending -= 1;

    if (!result) {
      // Il motivo VERO sta già scritto su `nodes.data` — `giveUp()` lo mette lì prima di
      // tornare. Un messaggio fisso qui lo coprirebbe con un «non riuscita» che non dice niente
      // di più di uno spinner che si ferma: `refresh()` lo riporta dal server, dove `GenNode` sa
      // già mostrarlo (`node.error`). Fino ad allora, lo stato ottimista si toglie da solo.
      nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...genData(unlockRun(gen)) } } : node));
      await refresh();
      void invalidate('app:credits');
      return;
    }

    noteFirstGeneration();
    await refresh();
    void invalidate('app:credits');
  }

  /**
   * IL LOOP: preventivo, poi conferma solo se serve, poi MESSA IN CODA — la stessa separazione di
   * `loop.ts`. Il preventivo (`loop_plan`) non spende, e chi guarda deve poter vedere quante
   * generazioni e quanti crediti PRIMA che il clic diventi irreversibile (CLAUDE.md). Sopra 50
   * combinazioni la conferma è nativa (`confirm()`): un modale su misura sarebbe più lavoro per
   * un percorso che, sopra la soglia, è già raro di suo.
   *
   * `run_loop` NON GIRA NIENTE — mette in coda e torna. Il progresso si vede nel nodo `list` di
   * output che compare accanto (item con `status: 'queued'` che diventano `done`/`failed` mano a
   * mano che il cron, ogni minuto, drena la coda): `refresh()` qui riporta quella lista appena
   * creata, e da lì in poi la realtime su `nodes`/`node_runs` (già pubblicata) aggiorna da sola.
   */
  async function runLoop(id: string) {
    const plan = await post('loop_plan', { node_id: id });
    if (!plan) return;

    const safety = plan.safety as { verdict: 'run' | 'confirm' | 'refuse'; count: number } | undefined;
    if (!safety || safety.verdict === 'refuse') {
      failed = 'Too many combinations: split the loop';
      return;
    }

    if (safety.verdict === 'confirm') {
      const cost = plan.cost as { total: number | null } | undefined;
      const costLabel = typeof cost?.total === 'number' ? `${formatCredits(cost.total)} crediti` : 'costo variabile';
      const ok = confirm(
        `Genera ${safety.count} combinazioni (${costLabel})? Verranno prodotte nei prossimi minuti, non subito.`
      );
      if (!ok) return;
    }

    await post('run_loop', { node_id: id, confirm: safety.verdict === 'confirm' ? '1' : '0' });
    await refresh();
    void invalidate('app:credits');
  }

  /** Ferma i biglietti non ancora reclamati da un tick — quelli già in corso finiscono, i
   *  risultati già pronti restano nella lista di output. */
  async function cancelLoopFor(id: string) {
    await post('cancel_loop', { node_id: id });
    await refresh();
  }

  /**
   * ESEGUI FLUSSO: stesso preventivo-poi-conferma del loop, ma su più nodi collegati invece di
   * una griglia di combinazioni. `run_workflow` mette in coda e torna: il cron
   * (`canvas/runs/tick`) drena i biglietti rispettando `dependsOn`, e la realtime su `nodes`
   * aggiorna da sola man mano che ognuno finisce.
   */
  let workflowId = $state<string | null>(null);
  let workflowNodeIds = $state<string[]>([]);

  async function runWorkflow(ids: string[]): Promise<boolean> {
    const plan = await post('workflow_plan', { node_id: ids });
    if (!plan) return false;

    const ok = confirm(
      `${(plan.steps as unknown[]).length} passi, circa ${formatCredits(plan.estimatedCredits as number)} crediti. Avviare il flusso?`
    );
    if (!ok) return false;

    const markRunning = (fn: (gen: GenNodeState) => GenNodeState) => {
      nodes = nodes.map((node) => {
        if (!ids.includes(node.id)) return node;
        const gen = genOf(node);
        return gen ? { ...node, data: { ...node.data, ...genData(fn(gen)) } } : node;
      });
    };

    markRunning(startRun);

    const result = await post('run_workflow', { node_id: ids });
    if (!result) {
      markRunning(unlockRun);
      return false;
    }

    workflowId = result.workflowId as string;
    workflowNodeIds = ids;
    noteFirstGeneration();
    await refresh();
    void invalidate('app:credits');
    return true;
  }

  const RECENT_RUNS = 20;

  type GraphRunRows = Parameters<typeof nodeOutputs>[1];

  const graphEdges = $derived(edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target })));
  const staleNodeIds = $derived(staleIds(nodeOutputs(nodes, runs as GraphRunRows), graphEdges));
  const runListing = $derived(recentRuns(runs as GraphRunRows, new Map(nodes.map((n) => [n.id, n.displayName ?? n.type])), RECENT_RUNS));

  const GRAPH_FIELDS: Record<GraphScope, (ids: string[]) => Record<string, string | string[]>> = {
    [GraphScope.Downstream]: (ids) => ({ graph: GraphScope.Downstream, node_id: ids[0] }),
    [GraphScope.Stale]: (ids) => ({ graph: GraphScope.Stale, node_ids: ids })
  };

  async function runGraph(graph: GraphScope, ids: string[]): Promise<void> {
    const fields = GRAPH_FIELDS[graph](ids);
    const plan = await post('graph_plan', fields);
    if (!plan) return;

    const steps = plan.steps as { nodeId: string }[];
    if (!confirm(`${steps.length} runs, about ${formatCredits(plan.credits as number)} credits. Start?`)) return;

    const result = await post('run_graph', fields);
    if (!result) return;

    workflowId = result.workflowId as string;
    workflowNodeIds = steps.map((step) => step.nodeId);
    noteFirstGeneration();
    await refresh();
    void invalidate('app:credits');
  }

  const workflowRunning = $derived(
    workflowId !== null &&
      nodes.some((node) => workflowNodeIds.includes(node.id) && genOf(node)?.running)
  );

  $effect(() => {
    if (workflowId !== null && !workflowRunning) {
      workflowId = null;
      workflowNodeIds = [];
    }
  });

  async function stopWorkflow() {
    if (!workflowId) return;
    await post('cancel_workflow', { workflow_id: workflowId });
    workflowId = null;
    workflowNodeIds = [];
    await refresh();
  }

  /** Ritenta UN item fallito di una lista che è output di un loop — subito, non in coda
   *  (`loop.ts::retryLoopCombination`): il server rilegge i valori dell'iterazione dal biglietto
   *  originale in `node_runs`, questa funzione passa solo cosa identifica quale item. */
  async function retryLoopItem(listNodeId: string, list: ListNodeState, genNodeId: string, index: number) {
    const item = list.items[index];
    if (!item) return;

    await post('retry_loop_combo', {
      node_id: genNodeId,
      output_list_node_id: listNodeId,
      label: item.label ?? '',
      run_id: item.run_id ?? ''
    });
    await refresh();
    void invalidate('app:credits');
  }

  /**
   * SBLOCCARE UNA CORSA CHE NON TORNA. Ottimista come il trascinamento: subito spento sullo
   * schermo, e scritto solo alla fine — il nodo altrimenti resterebbe «in corso» a vita quando
   * il provider non risponde più o la scheda è stata chiusa a metà giro.
   */
  /** Rimettere in vetrina un giro di prima: lo decide il server, che sa quale asset è quel giro. */
  async function restore(id: string, gen: GenNodeState, runId: string) {
    const hit = (runsByNode[id] ?? []).find((r) => r.id === runId);
    if (hit?.mediaId) {
      nodes = nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, refId: hit.mediaId, running: false, error: null } }
          : node
      );
    }
    await post('restore', { node_id: id, run_id: runId });
    await refresh();
  }

  /**
   * SINCRONIZZARE UN NODO `products` O `social_account_feed`. Ottimista sullo stato — "sta
   * scaricando" appare subito — ma il risultato lo scrive il server: qui non c'è modo di sapere
   * quanti prodotti o post sono arrivati prima che risponda.
   */
  async function sync(id: string) {
    const before = nodes.find((node) => node.id === id);
    if (!before) { return; }
    if (!online) {
      failed = OFFLINE_RUN_NOTICE;
      return;
    }

    nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, sync_status: 'running' } } : node));
    pending += 1;

    const result = await postAtVersion('sync', id, {});
    pending -= 1;

    if (!result) {
      await refresh();
      return;
    }

    await refresh();
  }

  async function unlock(id: string) {
    const before = nodes.find((node) => node.id === id);
    if (!before) {
      return;
    }

    const data = { ...before.data, running: false, error: null };
    nodes = nodes.map((node) => (node.id === id ? { ...node, data } : node));
    await write(id, data, SaveTiming.Now);
  }

  async function move(id: string, x: number, y: number) {
    const before = nodes.find((node) => node.id === id);
    if (before && motionOf(before)?.kind === FrameKind.Group) {
      const delta = { dx: x - before.x, dy: y - before.y };
      nodes = nodes.map((n) => (n.id === id ? { ...n, x, y } : layoutOf(n.data).groupId === id ? { ...n, x: n.x + delta.dx, y: n.y + delta.dy } : n));
      const placed = places.moveGroup(id, x, y);
      keepOutbox();
      await placed;
      return;
    }
    nodes = nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
    const placed = places.move(id, x, y);
    keepOutbox();
    await placed;
  }

  /**
   * RIDIMENSIONARE: STESSA FORMA DI `move` — ottimista, last-write-wins, nessuna voce nello stack
   * di undo (lo spostamento non ne ha una propria sulla taglia, e `MoveGesture` porta solo
   * `x`/`y`). Scrive `userHeight`: da qui in poi `tileHeight` prende QUESTA misura, non più
   * quella calcolata da `grownTextNodeHeight` — un ridimensionamento a mano vince sulla crescita
   * automatica, la stessa regola già scritta in `text-node-grow.ts`.
   */
  const FIT_SLACK_PX = 1;

  const PICTURE_OF_KIND: Record<FrameKind, (motion: { format: MotionFormat }, row: { w: number; h: number }) => { width: number; height: number }> = {
    [FrameKind.Frame]: (motion) => FORMATS[motion.format],
    [FrameKind.Element]: (_, row) => ({ width: row.w, height: row.h }),
    [FrameKind.Group]: (_, row) => ({ width: row.w, height: row.h })
  };

  function frameFit(id: string, w: number, mode: NodeMode = NodeMode.Preview): { w: number; h: number } | null {
    const row = nodes.find((node) => node.id === id);
    const motion = motionOf(row ?? { id, type: '', data: {} });
    if (!motion || !row) {
      return null;
    }
    const open = layersSource.video;
    const picture = open?.nodeId === id ? open.doc : PICTURE_OF_KIND[motion.kind](motion, row);
    return frameNodeSize(w, picture, mode, motion.kind);
  }

  $effect(() => {
    const open = layersSource.video;
    const row = open ? untrack(() => nodes.find((node) => node.id === open.nodeId)) : null;
    if (!open || !row) {
      return;
    }
    const fit = frameNodeSize(row.w, open.doc, NodeMode.Preview, motionOf(row)?.kind);
    if (Math.abs(fit.h - row.h) > FIT_SLACK_PX) {
      void storeSize(row.id, fit.w, fit.h);
    }
  });

  function framePlan(id: string, w: number, h: number): FrameResize | null {
    const row = nodes.find((node) => node.id === id);
    const motion = motionOf(row ?? { id, type: '', data: {} });
    if (!motion || !row) {
      return null;
    }
    const open = layersSource.video?.nodeId === id ? layersSource.video : null;
    const shown = open ? { ...motion, format: formatOf(open.doc) } : motion;
    const mode = id === inlineMotion ? NodeMode.Edit : NodeMode.Preview;
    return frameResize(shown, { w, h }, open?.doc ?? PICTURE_OF_KIND[motion.kind](motion, row), mode);
  }

  async function sizeFrameDoc(id: string, picture: { width: number; height: number }) {
    const open = layersSource.video;
    if (open?.nodeId === id) {
      open.edit(fitToNode(open.doc, picture), 'Resized the frame');
      return;
    }
    const result = await post('frameSize', { node_id: id, width: picture.width, height: picture.height });
    if (result?.undo) {
      pushGesture({ items: result.undo as UndoItem[] });
    }
  }

  async function resize(id: string, width: number, height: number) {
    const group = nodes.find((n) => n.id === id);
    if (group && motionOf(group)?.kind === FrameKind.Group) {
      const placed = (n: Tile): Placed => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, rotation: layoutOf(n.data).rotation });
      const scaled = new Map(scaleGroup(placed(group), nodes.filter((n) => layoutOf(n.data).groupId === id).map(placed), { w: width, h: height }).map((t) => [t.id, t]));
      nodes = nodes.map((n) => {
        const t = scaled.get(n.id);
        return t ? { ...n, x: t.x, y: t.y, w: t.w, h: t.h, userHeight: t.h } : n;
      });
      await post('scaleGroup', { id, width: String(width), height: String(height) });
      return;
    }
    const plan = framePlan(id, width, height);
    await storeSize(id, plan?.w ?? width, plan?.h ?? height);
    if (plan?.picture) {
      await sizeFrameDoc(id, plan.picture);
    }
  }

  async function storeSize(id: string, w: number, h: number) {
    nodes = nodes.map((n) => (n.id === id ? { ...n, w, h, userHeight: h } : n));
    const placed = places.resize(id, w, h);
    keepOutbox();
    await placed;
  }

  /**
   * IL CONTENUTO PASSA DALLA VERSIONE, e un conflitto non si ignora: il server risponde 409
   * quando qualcun altro ha scritto per primo, e qui si dice invece di credere di aver salvato.
   * La versione che torna sostituisce quella che si aveva, o la scrittura dopo fallirebbe uguale.
   */
  /**
   * UNA SCRITTURA PER GESTO, non per fotogramma: il client chiama qui quando il trascinamento
   * finisce. Il repository è last-write-wins apposta — due mani sullo stesso nodo si contendono
   * il puntatore, e nessuna delle due perde lavoro scritto.
   */
  async function share(id: string, on: boolean): Promise<{ url: string } | null> {
    const result = await post('share', { node_id: id, on: on ? 'true' : 'false' });
    if (!result) {
      return null;
    }

    nodes = nodes.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, public: on } } : node
    );

    if (!on) {
      return { url: '' };
    }

    const url = shareUrlOf(window.location.origin, typeof result.path === 'string' ? result.path : null);
    return url ? { url } : null;
  }

  async function saveNode(id: string, patch: Record<string, unknown>, base: Record<string, unknown>): Promise<WriteOutcome> {
    const out = await writeWithRetry({
      send: (changed, believed) =>
        send('write', { node_id: id, patch: JSON.stringify(changed), base: JSON.stringify(believed) }),
      reread: async () => {
        const snapshot = await send('snapshot', {});
        const rows = ((snapshot.data ?? {}) as { nodes?: CanvasNodeRecord[] }).nodes ?? [];
        return rows.find((node) => node.id === id)?.data ?? null;
      },
      patch,
      base
    });
    if (out.ok) {
      failed = null;
      failedIsCreditsExhausted = false;
      return out;
    }
    announce('write', out.reason, out.detail);
    return out;
  }

  async function sendSave(id: string, touched: Record<string, unknown>): Promise<SendResult> {
    const current = nodes.find((node) => node.id === id);
    if (!current) { return SendResult.Dropped; }
    const change = diffNodeData(current.saved, { ...current.data, ...serverWritten(touched) }, Object.keys(touched));
    if (!Object.keys(change).length) { return SendResult.Saved; }

    const out = await saveNode(id, change, baseOf(current.saved, change));
    if (!out.ok) { return sendResultOf(out.reason); }

    const written = out.node;
    nodes = nodes.map((node) => node.id === id
      ? { ...node, data: keepLocal(written.data, node.data, saves.dirtyKeys(id)), saved: written.data, version: Math.max(written.version, node.version) }
      : node);
    pushGesture({
      items: [
        {
          kind: 'node.update',
          nodeId: id,
          before: { data: current.saved },
          after: { data: written.data },
          expectedVersion: current.version
        }
      ]
    });
    return SendResult.Saved;
  }

  function write(id: string, patch: Record<string, unknown>, timing = SaveTiming.Debounced): Promise<boolean> {
    const current = nodes.find((node) => node.id === id);
    if (!current) { return Promise.resolve(false); }
    nodes = nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node);
    const saved = saves.schedule(id, patch, timing);
    keepOutbox();
    return saved;
  }

  function changeGen(id: string, gen: GenNodeState, patch: Partial<GenNodeState>) {
    if (typeof patch.prompt === 'string') {
      const next = { ...textCostEstimates };
      delete next[id];
      textCostEstimates = next;
    }
    void write(id, genPatch(gen, patch));
  }

  async function estimateTextCost(id: string, prompt: string, model: string, revision: string) {
    const asked = JSON.stringify([prompt, model, revision]);
    if (textCostEstimates[id]?.asked === asked) {
      return;
    }
    const result = await post('estimate_text_cost', { node_id: id, prompt, model });
    const outputTokens = result?.estimatedOutputTokens;
    const systemTokens = result?.systemPromptTokens;
    const userTokens = result?.userPromptTokens;
    const current = nodes.find((node) => node.id === id);
    const currentGen = current ? genOf(current) : null;
    const currentModel = currentGen
      ? effectiveModel(currentGen.medium, currentGen.model, catalogue[currentGen.medium] ?? []) ?? ''
      : '';
    if (
      typeof outputTokens !== 'number' ||
      typeof systemTokens !== 'number' ||
      typeof userTokens !== 'number' ||
      currentGen?.prompt !== prompt ||
      currentModel !== model ||
      textEstimateRevision(id) !== revision
    ) {
      return;
    }

    textCostEstimates = {
      ...textCostEstimates,
      [id]: {
        inputTokens: systemTokens + userTokens,
        outputTokens,
        variableInput: result?.variableInput === true,
        revision,
        asked
      }
    };
  }

  /**
   * Una linea NON si disegna prima che il server la restituisca: con un id inventato si finirebbe
   * per averla due volte appena la vera arriva. Il verso l'ha già scelto la tela guardando i due
   * estremi — `edgeKindsFor` — e qui si salva quello, non un `derives_from` fisso.
   */
  function link(source: string, target: string, kind: CanvasEdgeKind, targetHandle: ConnectorType | null, sourceHandle: string | null = null): Connection {
    const line: Connection = { id: crypto.randomUUID(), canvasId: data.canvas.id, sourceNodeId: source, targetNodeId: target, sourceHandle: sourceHandle ?? kind, targetHandle, mode: 'fixed' };
    edges = [...edges, toEdge(line)];
    lines.push({
      opId: line.id,
      action: LineAction.Connect,
      fields: {
        connection_id: line.id,
        source_node_id: source,
        target_node_id: target,
        kind,
        ...(targetHandle ? { target_handle: targetHandle } : {}),
        ...(sourceHandle ? { source_handle: sourceHandle } : {})
      }
    });
    return line;
  }

  async function connect(source: string, target: string, kind: CanvasEdgeKind, targetHandle: ConnectorType | null, sourceHandle: string | null = null) {
    if (nodes.find((n) => n.id === target)?.type !== 'motion') {
      const line = link(source, target, kind, targetHandle, sourceHandle);
      pushGesture({ items: [{ kind: 'edge.create', edgeId: line.id, sourceNodeId: source, targetNodeId: target }] });
      return;
    }
    const res = await post('connect', {
      source_node_id: source,
      target_node_id: target,
      kind,
      ...(targetHandle ? { target_handle: targetHandle } : {}),
      ...(sourceHandle ? { source_handle: sourceHandle } : {})
    });

    const created = (res?.connection ?? null) as Connection | null;
    if (!created) {
      return;
    }

    edges = [...edges.filter((edge) => edge.id !== created.id), toEdge(created)];
    const linked = (res?.linked as { undo?: UndoItem[] } | null)?.undo ?? [];
    pushGesture({
      items: [{ kind: 'edge.create', edgeId: created.id, sourceNodeId: created.sourceNodeId, targetNodeId: created.targetNodeId }, ...linked]
    });
  }

  /**
   * "COLLEGA A NUOVO…": un nodo del tipo scelto nasce a destra della selezione, GIÀ CON UN
   * MODELLO — il primo del catalogo per quel medium — perché senza modello un nodo `image`/`video`
   * non ha porte (`portsOfTile`, sopra: `!choice` → `[]`), e il piano di collegamento
   * troverebbe zero connettori su un nodo appena nato. Il piano stesso (`planConnectSelection`) è
   * lo stesso che decide un collegamento a un nodo ESISTENTE (`connectExisting`, sotto): la
   * domanda "quale porta per quale sorgente" non cambia perché il bersaglio è appena nato.
   */
  let focus = $state<FocusRequest | null>(null);

  function focusOn(ids: string[], free?: Insets, mode = FocusMode.Frame) {
    focus = { ids, key: (focus?.key ?? 0) + 1, free, mode };
  }

  function tilePoster(n: { id: string; type: string; data: Record<string, unknown> }): Poster | null {
    const motion = frameLook(n).poster;
    if (motion) {
      return { url: motion, source: PosterSource.Image };
    }
    const file = n.data.refId ?? n.data.assetId;
    return mediaPoster(n.type, assetUrl(typeof file === 'string' ? file : null));
  }

  function frameLook(n: { id: string; type: string; data: Record<string, unknown> }) {
    const motion = motionOf(n);
    return motion ? { poster: assetUrl(motion.posterAssetId), still: motion.format === MotionFormat.Poster, element: motion.kind === FrameKind.Element } : {};
  }

  $effect(() =>
    layersSource.publishCanvas({
      get nodes() {
        return nodes.map((n) => ({ id: n.id, type: n.type, name: n.displayName ?? null, head: frameHead(n.type, n.data), ...frameLook(n) }));
      },
      outlinesUrl: `/p/${data.projectId}/c/${data.canvas.id}/frame-outlines`,
      outlines: data.outlines,
      previewUrl: (nodeId) => motionPreviewPath({ projectId: data.projectId, canvasId: data.canvas.id, nodeId }),
      get selected() {
        return selectedIds;
      },
      select: (ids) => focusOn(ids, undefined, FocusMode.Select),
      open: (id) => {
        requestMotion(id);
        focusOn([id], undefined, FocusMode.Select);
      }
    })
  );

  function rectOf(id: string): Rect | null {
    const tile = tiles.find((t) => t.id === id);
    return tile ? { x: tile.x, y: tile.y, w: tile.w, h: tile.h } : null;
  }

  async function connectNew(ids: string[], medium: GenMedium, prompt = '') {
    const sources: ConnectSource[] = nodes
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ id: n.id, type: n.type }));
    if (!sources.length) { return; }

    const model = effectiveModel(medium, null, catalogue[medium] ?? []);
    const modalities = model ? { input: catalogue[medium].find((c) => c.id === model)?.inputModalities ?? [] } : { input: [] };

    const size = genNodeSize(medium);
    const from = ids.map(rectOf).filter((r): r is Rect => r !== null);
    const occupied = tiles.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
    const at = placeBeside(from, size, occupied);
    const created = await post('create', {
      type: medium,
      x: at.x,
      y: at.y,
      data: JSON.stringify({ ...newNodeRow(medium), model, ...(prompt ? { prompt } : {}) })
    });
    const node = (created?.node ?? null) as CanvasNodeRecord | null;
    if (!node) { return; }

    nodes = [...nodes.filter((n) => n.id !== node.id), toTile(node, { select: true })];
    const items: UndoItem[] = [{ kind: 'node.create', nodeId: node.id, after: { type: node.type, position: node.position, data: node.data } }];

    const plan = planConnectSelection({ sources, target: { kind: medium, modalities } });
    for (const wire of plan.wires) {
      const res = await post('connect', {
        source_node_id: wire.sourceId,
        target_node_id: node.id,
        kind: 'derives_from',
        target_handle: wire.connector
      });
      const connection = (res?.connection ?? null) as Connection | null;
      if (connection) {
        edges = [...edges.filter((e) => e.id !== connection.id), toEdge(connection)];
        items.push({ kind: 'edge.create', edgeId: connection.id, sourceNodeId: connection.sourceNodeId, targetNodeId: connection.targetNodeId });
      }
    }
    if (plan.rejected.length) {
      failed = `Not connected: ${plan.rejected.map((r) => r.why).join('; ')}`;
    }
    pushGesture({ items });
    focusOn([...ids, node.id]);
  }

  /**
   * "COLLEGA A…": la stessa domanda di `connectNew`, su un nodo che c'è già — le sue porte vengono
   * dal SUO modello attuale, non da uno appena scelto.
   */
  async function connectExisting(ids: string[], targetId: string) {
    const target = nodes.find((n) => n.id === targetId);
    if (!target || (target.type !== 'text' && target.type !== 'image' && target.type !== 'video')) {
      failed = 'This node takes no connections';
      return;
    }

    const sources: ConnectSource[] = nodes
      .filter((n) => ids.includes(n.id) && n.id !== targetId)
      .map((n) => ({ id: n.id, type: n.type }));
    if (!sources.length) { return; }

    const model = typeof target.data.model === 'string' ? target.data.model : null;
    const choice = model ? catalogue[target.type]?.find((c) => c.id === model) : null;
    const modalities = { input: choice?.inputModalities ?? [] };

    const plan = planConnectSelection({ sources, target: { kind: target.type, modalities } });
    const items: UndoItem[] = [];
    for (const wire of plan.wires) {
      const line = link(wire.sourceId, targetId, 'derives_from', wire.connector);
      items.push({ kind: 'edge.create', edgeId: line.id, sourceNodeId: line.sourceNodeId, targetNodeId: line.targetNodeId });
    }
    if (plan.rejected.length) {
      failed = `Not connected: ${plan.rejected.map((r) => r.why).join('; ')}`;
    }
    if (items.length) { pushGesture({ items }); }
  }

  let confirmingUncensoredSwitch = $state(false);
  let resolveUncensoredSwitch: ((ok: boolean) => void) | null = null;

  function confirmUncensoredSwitch(): Promise<boolean> {
    confirmingUncensoredSwitch = true;
    return new Promise((resolve) => {
      resolveUncensoredSwitch = resolve;
    });
  }

  function settleUncensoredSwitch(ok: boolean) {
    resolveUncensoredSwitch?.(ok);
    resolveUncensoredSwitch = null;
  }

  function onUncensoredSwitchConfirmed() {
    settleUncensoredSwitch(true);
  }

  $effect(() => {
    if (!confirmingUncensoredSwitch) {
      untrack(() => settleUncensoredSwitch(false));
    }
  });

  let confirmingAudioOperationSwitch = $state(false);
  let resolveAudioOperationSwitch: ((ok: boolean) => void) | null = null;

  function confirmAudioOperationSwitch(): Promise<boolean> {
    confirmingAudioOperationSwitch = true;
    return new Promise((resolve) => {
      resolveAudioOperationSwitch = resolve;
    });
  }

  function settleAudioOperationSwitch(ok: boolean) {
    resolveAudioOperationSwitch?.(ok);
    resolveAudioOperationSwitch = null;
  }

  function onAudioOperationSwitchConfirmed() {
    settleAudioOperationSwitch(true);
  }

  $effect(() => {
    if (!confirmingAudioOperationSwitch) {
      untrack(() => settleAudioOperationSwitch(false));
    }
  });

  /**
   * CAMBIARE OPERAZIONE SU UN NODO AUDIO PUÒ LASCIARE UN ARCO SENZA PORTA — voice changer prende
   * audio/video, non testo: passare a text to speech con un testo collegato lo caccerebbe in
   * silenzio. Stessa dottrina di `commonChange` sul modello: si chiede conferma PRIMA, si
   * staccano solo gli archi che l'operazione nuova non accetta più, quelli compatibili restano.
   */
  async function changeAudioOperation(id: string, gen: GenNodeState, next: AudioOperationId) {
    const wired: { edgeId: string; sourceNodeId: string; connector: ConnectorType }[] = edges
      .filter((e) => e.target === id && e.targetHandle)
      .map((e) => ({ edgeId: e.id, sourceNodeId: e.source, connector: e.targetHandle as ConnectorType }));
    const orphaned = orphanedByModelChange(wired, audioInputPorts(next));

    if (orphaned.length && !(await confirmAudioOperationSwitch())) {
      return;
    }

    const droppedEdges: UndoItem[] = [];
    for (const drop of orphaned) {
      const item = await disconnect(drop.edgeId, false);
      if (item) { droppedEdges.push(item); }
    }

    changeGen(id, gen, { params: { ...gen.params, operation: next }, model: operationSpec(next).defaultModel });
    if (droppedEdges.length) { pushGesture({ items: droppedEdges }); }
  }

  /**
   * LA BARRA DELLA SELEZIONE HA SCRITTO — un campo, applicato a ogni nodo selezionato, UNO o
   * MOLTI: con un nodo solo è la stessa funzione, non un percorso a parte, perché la domanda «un
   * arco cade con questo modello?» (`orphanedByModelChange`) vale uguale se il nodo scelto è uno
   * o cinque. La conferma va chiesta PRIMA, guardando OGNI nodo selezionato — cambiare modello e
   * scoprire dopo che un arco è appena sparito sarebbe la sorpresa che quella funzione esiste per
   * evitare.
   *
   * UN GESTO SOLO — quanti nodi cambiano e quanti fili cadono, la stessa regola con un nodo o con
   * cinque: annullarlo a metà (un nodo tornato al vecchio modello, un altro no, o un filo che non
   * è tornato) è peggio di non annullare niente.
   */
  async function commonChange(
    ids: string[],
    patch: {
      model?: string | null;
      aspectRatio?: string;
      duration?: number;
      resolution?: string;
      audio?: boolean;
      enhancePrompt?: boolean;
      repeat?: number;
      /** I campi dichiarati da `ai_models.param_schema` che il toolbar generico scrive — un solo
       *  bucket dinamico, invece di un campo esplicito per ogni nome di parametro possibile. */
      dynamicParams?: Record<string, unknown>;
    }
  ) {
    const chosen = nodes.filter((n) => ids.includes(n.id));
    if (!chosen.length) { return; }

    const droppedEdges: UndoItem[] = [];
    const clearedReferenceIds: string[] = [];

    if (patch.model !== undefined) {
      const uncensoredTargets = chosen.filter((n) => {
        if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') { return false; }
        const model = catalogue[n.type]?.find((c) => c.id === patch.model);
        const hasIncomingEdges = edges.some((e) => e.target === n.id);
        const hasReferences = referencesOf(n.data).length > 0;
        return needsUncensoredConfirm({ nextUncensored: model?.uncensored === true, hasIncomingEdges, hasReferences });
      });

      if (uncensoredTargets.length && !(await confirmUncensoredSwitch())) {
        return;
      }
      clearedReferenceIds.push(...uncensoredTargets.map((n) => n.id));

      const orphaned = chosen.flatMap((n) => {
        if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') { return []; }
        const model = catalogue[n.type]?.find((c) => c.id === patch.model);
        const nextConnectors = connectorsFor(n.type, { input: model?.inputModalities ?? [], uncensored: model?.uncensored });
        const wired: { edgeId: string; sourceNodeId: string; connector: ConnectorType }[] = edges
          .filter((e) => e.target === n.id && e.targetHandle)
          .map((e) => ({ edgeId: e.id, sourceNodeId: e.source, connector: e.targetHandle as ConnectorType }));
        return orphanedByModelChange(wired, nextConnectors);
      });

      if (orphaned.length && !uncensoredTargets.length && !confirm(`${orphaned.length} connection(s) will be dropped with this model. Continue?`)) {
        return;
      }
      for (const drop of orphaned) {
        const item = await disconnect(drop.edgeId, false);
        if (item) { droppedEdges.push(item); }
      }
      for (const nodeId of clearedReferenceIds) {
        await write(nodeId, { references: [] }, SaveTiming.Now);
      }
    }

    const { model, dynamicParams, ...params } = patch;
    const hasParams = Object.values(params).some((v) => v !== undefined) || !!dynamicParams;
    const items = chosen.map((n) => {
      const nextParams = { ...(n.data.params as Record<string, unknown>), ...params, ...dynamicParams };

      // Un modello nuovo può non fare più il gradino di durata o la risoluzione salvati: si
      // scivola al più vicino fra quelli che offre — mai una durata o un token di risoluzione che
      // quel modello rifiuta (`happyhorse-1.0` non fa 480p, `video_renders` cb1de6e2).
      if (model !== undefined && (n.type === 'video' || n.type === 'image')) {
        const nextModel = catalogue[n.type]?.find((c) => c.id === model);
        const aspectRatio = nextModel ? snapAspectRatio(nextModel, nextParams.aspectRatio as string | undefined) : undefined;
        if (nextModel && aspectRatio) {
          nextParams.aspectRatio = aspectRatio;
        } else if (nextModel) {
          delete nextParams.aspectRatio;
        }
      }

      if (model !== undefined && n.type === 'video') {
        const nextModel = catalogue.video?.find((c) => c.id === model);
        const options = nextModel?.durationOptions;
        const savedDuration = (n.data.params as Record<string, unknown> | undefined)?.duration;
        if (options?.length && typeof savedDuration === 'number') {
          nextParams.duration = nearestVideoDuration(options, savedDuration);
        }
        if (nextModel) {
          const savedResolution = (n.data.params as Record<string, unknown> | undefined)?.resolution as
            | string
            | undefined;
          const resolution = snapResolution(nextModel, savedResolution);
          if (resolution) {
            nextParams.resolution = resolution;
          } else {
            delete nextParams.resolution;
          }
        }
      }

      // Stesso scivolamento per l'immagine: Seedream 5 Lite offre [2K,4K], Seedream 5 Pro [1K,2K]
      // — una risoluzione salvata che il modello appena scelto non fa più va al suo default, mai
      // spedita così com'è.
      if (model !== undefined && n.type === 'image') {
        const nextModel = catalogue.image?.find((c) => c.id === model);
        if (nextModel) {
          const savedResolution = (n.data.params as Record<string, unknown> | undefined)?.resolution as
            | string
            | undefined;
          const resolution = snapResolution(nextModel, savedResolution);
          if (resolution) {
            nextParams.resolution = resolution;
          } else {
            delete nextParams.resolution;
          }
        }
      }

      // I campi dinamici (`quality`, `output_compression`…) seguono lo stesso scivolamento della
      // risoluzione, sul modello che dichiara loro: un nome che il modello nuovo non conosce più
      // sparisce, un valore fuori dal suo elenco scivola al primo valido — mai un token che il
      // provider appena scelto rifiuta.
      if (model !== undefined && DYNAMIC_PARAM_TYPES.has(n.type)) {
        const nextModel = catalogue[n.type as GenMedium]?.find((c) => c.id === model);
        const savedParams = (n.data.params as Record<string, unknown> | undefined) ?? {};
        const dynamic = nextParams as unknown as Record<string, unknown>;
        const snapped = snapDynamicParams(nextModel?.params ?? [], { ...savedParams, ...dynamic });
        for (const declared of nextModel?.params ?? []) {
          if (declared.name in snapped) {
            dynamic[declared.name] = snapped[declared.name];
          } else {
            delete dynamic[declared.name];
          }
        }
      }

      return {
        node_id: n.id,
        version: n.version,
        patch: hasParams || model !== undefined
          ? { ...(model !== undefined ? { model } : {}), params: nextParams }
          : patch
      };
    });

    const result = await post('batchWrite', { items: JSON.stringify(items) });
    const results = (result?.results ?? []) as { nodeId: string; outcome: string; node?: CanvasNodeRecord }[];
    const conflicts = results.filter((r) => r.outcome === 'conflict');
    if (conflicts.length) {
      failed = `${conflicts.length} node(s) not saved: changed by someone else meanwhile`;
    }

    const written = results.filter((r) => r.outcome === 'written' && r.node).map((r) => r.node as CanvasNodeRecord);
    if (written.length) {
      const byId = new Map(written.map((n) => [n.id, n]));
      nodes = nodes.map((n) => (byId.has(n.id) ? toTile(byId.get(n.id)!) : n));
    }

    const writeItems: UndoItem[] = results
      .filter((r) => r.outcome === 'written' && r.node)
      .map((r) => {
        const before = chosen.find((n) => n.id === r.nodeId)!;
        const node = r.node as CanvasNodeRecord;
        return { kind: 'node.update', nodeId: r.nodeId, before: { data: before.data }, after: { data: node.data }, expectedVersion: before.version };
      });

    if (droppedEdges.length || writeItems.length) {
      pushGesture({ items: [...droppedEdges, ...writeItems] });
    }
  }

  /**
   * Una linea tolta sparisce subito e torna se il server rifiuta: l'attesa qui si vedrebbe.
   *
   * `recordUndo` È SPENTO quando chi chiama fa parte di un gesto più grande — il cambio di
   * modello di `commonChange`, sotto, che sgancia N fili come parte di UN SOLO Ctrl+Z: spingere
   * qui un gesto a testa lo spezzerebbe in N+1, e annullarne uno solo lascerebbe il modello
   * cambiato con un filo tornato e gli altri no.
   */
  async function disconnect(connectionId: string, recordUndo = true): Promise<UndoItem | null> {
    const removed = edges.find((e) => e.id === connectionId);
    if (!removed) {
      return null;
    }

    edges = edges.filter((e) => e.id !== connectionId);
    lines.push({ opId: crypto.randomUUID(), action: LineAction.Disconnect, fields: { connection_id: connectionId } });

    const item: UndoItem = { kind: 'edge.delete', edgeId: removed.id, sourceNodeId: removed.source, targetNodeId: removed.target };
    if (recordUndo) { pushGesture({ items: [item] }); }
    return item;
  }

  /** Fisso o iterate — ottimista come ogni altro campo della linea: subito sullo schermo, e
   *  ripristinato se il server rifiuta (l'arco è caduto nel frattempo, o non è più di quest'org). */
  async function setEdgeMode(connectionId: string, mode: WireMode) {
    const before = edges.find((e) => e.id === connectionId)?.mode;
    edges = edges.map((e) => (e.id === connectionId ? { ...e, mode } : e));

    const done = await post('set_edge_mode', { connection_id: connectionId, mode });
    if (!done) {
      edges = edges.map((e) => (e.id === connectionId ? { ...e, mode: before } : e));
    }
  }

  /**
   * LE TILE TOLTE. `planDelete` dice cosa cade con loro — le linee verso un nodo che sparisce
   * resterebbero disegnate verso il vuoto fino al ricarico.
   *
   * Sparisce subito e torna se il server rifiuta: su una tela si lavora a gesti, e un nodo che
   * resta lì mezzo secondo dopo ⌫ fa premere ⌫ una seconda volta.
   */
  async function remove(ids: string[]) {
    const plan = planDelete({ ids, edges, undeletable: [] });
    if (plan.empty) {
      return;
    }

    const goneNodes = nodes.filter((n) => plan.itemIds.includes(n.id));
    const goneEdges = edges.filter((e) => plan.edgeIds.includes(e.id));

    nodes = nodes.filter((n) => !plan.itemIds.includes(n.id));
    edges = edges.filter((e) => !plan.edgeIds.includes(e.id));

    const done = await post('remove', {
      node_ids: plan.itemIds.join(','),
      connection_ids: plan.edgeIds.join(',')
    });
    if (!done) {
      nodes = [...nodes, ...goneNodes];
      edges = [...edges, ...goneEdges];
      return;
    }

    pushGesture({
      items: [
        ...goneEdges.map((e): UndoItem => ({ kind: 'edge.delete', edgeId: e.id, sourceNodeId: e.source, targetNodeId: e.target })),
        ...goneNodes.map((n): UndoItem => ({
          kind: 'node.delete',
          nodeId: n.id,
          before: { type: n.type, position: { x: n.x, y: n.y, z: 0 }, size: { width: n.w, height: n.h }, data: n.data, version: n.version }
        }))
      ]
    });
  }

  /**
   * ⌘D: duplica la selezione. Il server rilegge le righe VERE da `nodeIds` — la copia non fida
   * dello stato del client, che potrebbe avere una posizione o un contenuto non ancora salvato —
   * e restituisce nodi e linee già nati, pronti per lo stesso `toTile`/`toEdge` di ogni altra
   * creazione. Niente ottimismo qui: un duplicato che compare e poi sparisce (il server rifiuta)
   * è più confuso di un'attesa breve, e a differenza di un `move` non c'è "prima" a cui tornare.
   */
  /**
   * ⌘D/⌘V: UN GESTO SOLO, anche se sono N nodi e M archi nati insieme — annullarne metà (i nodi
   * tornano al vuoto ma un arco fra loro resta) è peggio di non annullare niente, la stessa
   * regola del cambio di modello che sgancia connessioni.
   */
  function createManyGesture(created: CanvasNodeRecord[], connected: Connection[]): Gesture {
    return {
      items: [
        ...created.map((n): UndoItem => ({ kind: 'node.create', nodeId: n.id, after: { type: n.type, position: n.position, data: n.data } })),
        ...connected.map((c): UndoItem => ({ kind: 'edge.create', edgeId: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId }))
      ]
    };
  }

  let formatsFor = $state<string | null>(null);

  async function createFormats(nodeId: string, targets: FormatTarget[]) {
    landed(await post('createFormats', { node_id: nodeId, targets: JSON.stringify(targets) }));
  }

  let lastDuplicate: LastDuplicate | null = null;

  async function duplicate(ids: string[], dragged?: Offset) {
    const offset = dragged ?? repeatOffset(lastDuplicate, ids);
    const fields: Fields = offset ? { node_ids: ids.join(','), dx: offset.dx, dy: offset.dy } : { node_ids: ids.join(',') };
    const result = await post('duplicate', fields);
    const created = (result?.nodes ?? []) as CanvasNodeRecord[];
    const connected = (result?.connections ?? []) as Connection[];
    lastDuplicate = offset && created.length ? { ids: created.map((n) => n.id), offset } : null;
    if (created.length) { nodes = [...nodes, ...created.map((n) => toTile(n, { select: true }))]; }
    if (connected.length) { edges = [...edges, ...connected.map(toEdge)]; }
    if (created.length) { pushGesture(createManyGesture(created, connected)); }
  }

  /**
   * ⌘C: gli APPUNTI SONO DI QUESTA TELA, in memoria — non del sistema operativo. Un `Ctrl+V` reale
   * del browser non saprebbe cosa incollare (che forma avrebbe un nodo `image` fuori da qui?), e
   * l'unico consumatore di questo copia è lo stesso ⌘V di `shortcuts.ts`. Portano `type`/`data`
   * intatti — l'incolla li rivalida comunque (`validateNodeData`, lato server) — e le posizioni
   * RELATIVE al centro della selezione: incollare altrove, o su un'altra tela della stessa org,
   * deve posare il gruppo dov'è il puntatore, non dov'era quando è stato copiato.
   */
  type Clipboard = {
    nodes: { type: string; data: Record<string, unknown>; dx: number; dy: number }[];
    edges: { sourceIndex: number; targetIndex: number; sourceHandle: string | null; targetHandle: string | null }[];
    freeIds: string[];
  };
  let clipboard = $state<Clipboard | null>(null);

  function copy(ids: string[]) {
    const chosen = nodes.filter((n) => ids.includes(n.id));
    if (!chosen.length) { return; }
    elementClipboard.copyTiles();

    const indexOf = new Map(chosen.map((n, i) => [n.id, i]));
    const cx = chosen.reduce((sum, n) => sum + n.x, 0) / chosen.length;
    const cy = chosen.reduce((sum, n) => sum + n.y, 0) / chosen.length;

    clipboard = {
      freeIds: chosen.flatMap((n) => freeElement([n.id]) ?? []),
      nodes: chosen.map((n) => ({ type: n.type, data: n.data, dx: n.x - cx, dy: n.y - cy })),
      edges: edges
        .filter((e) => indexOf.has(e.source) && indexOf.has(e.target))
        .map((e) => ({
          sourceIndex: indexOf.get(e.source)!,
          targetIndex: indexOf.get(e.target)!,
          // Il verso viaggia su `source_handle` (vedi `connect`, sopra): `kind` è la stessa cosa
          // letta dal lato del client, che `toEdge` ha già tradotto all'ingresso.
          sourceHandle: e.kind,
          targetHandle: e.targetHandle ?? null
        }))
    };
  }

  /** ⌘V: quel che `copy` ha in mano, riposato attorno al punto dato — vuoto se non si è mai copiato. */
  const PASTE_STAGGER = 24;

  async function pasteElementsAt(at: { x: number; y: number }, copied: CopiedElements) {
    for (const [i, clip] of copied.clipIds.entries()) {
      landed(await post('copyElement', { source: copied.frameId, clip, drop: JSON.stringify({ on: DropOn.Canvas, x: at.x + i * PASTE_STAGGER, y: at.y + i * PASTE_STAGGER }) }));
    }
  }

  const FRAME_CENTRE = { x: 0.5, y: 0.5 };

  async function pasteFreeInto(frameId: string, freeIds: string[]) {
    for (const source of freeIds) {
      landed(await post('copyFree', { source, drop: JSON.stringify({ on: DropOn.Frame, nodeId: frameId, at: FRAME_CENTRE }) }));
    }
  }

  async function paste(at: { x: number; y: number }) {
    const copied = elementClipboard.elements;
    if (elementClipboard.kind === Copied.Elements && copied) {
      await pasteElementsAt(at, copied);
      return;
    }
    if (!clipboard) { return; }
    const frameId = pasteIntoFrame(nodes.filter((n) => selectedIds.includes(n.id)).map((n) => ({ id: n.id, takesDrops: tileChromeOf(n).takesDrops })), clipboard.freeIds);
    if (frameId) {
      await pasteFreeInto(frameId, clipboard.freeIds);
      return;
    }

    const result = await post('paste', {
      nodes: JSON.stringify(clipboard.nodes.map((n) => ({ type: n.type, data: n.data, x: at.x + n.dx, y: at.y + n.dy }))),
      edges: JSON.stringify(clipboard.edges)
    });
    const created = (result?.nodes ?? []) as CanvasNodeRecord[];
    const connected = (result?.connections ?? []) as Connection[];
    if (created.length) { nodes = [...nodes, ...created.map((n) => toTile(n, { select: true }))]; }
    if (connected.length) { edges = [...edges, ...connected.map(toEdge)]; }
    if (created.length) { pushGesture(createManyGesture(created, connected)); }
  }

  async function insertTemplate(id: string, at: { x: number; y: number }) {
    const result = await post('template', { template_id: id, x: at.x, y: at.y });
    const created = (result?.nodes ?? []) as CanvasNodeRecord[];
    const connected = (result?.connections ?? []) as Connection[];
    if (!created.length) {
      return;
    }
    nodes = [...nodes, ...created.map((n) => toTile(n, { select: true }))];
    edges = [...edges, ...connected.map(toEdge)];
    pushGesture(createManyGesture(created, connected));
  }

  /**
   * ⌘Z / ⇧⌘Z: UNA SOLA AZIONE SERVER PER ENTRAMBI — annullare un gesto e ripeterne uno annullato
   * sono la STESSA domanda a `undoGesture` (lato server): applica le inverse del gesto che riceve
   * e restituisce IL GESTO CHE ANNULLA QUELLO — che per un redo è di nuovo un gesto da poter
   * annullare, con la versione che QUESTA scrittura ha lasciato, non quella di prima. Per questo
   * chi chiama non rimette da sé il gesto appena tolto sul lato opposto: aspetta quello che il
   * server restituisce (`onAccepted`) e spinge quello.
   *
   * UN RIFIUTO (409, un collega ha toccato lo stesso nodo) NON SPINGE NIENTE: le premesse del
   * gesto sono già cadute, e rimetterlo in circolo lo farebbe fallire di nuovo nello stesso modo
   * — `failed` dice perché, in chiaro.
   */
  async function applyUndo(gesture: Gesture, onAccepted: (redo: Gesture) => void) {
    await Promise.all([lines.drain(), places.flush(), saves.flush()]);
    const result = await post('undo', { items: JSON.stringify(gesture.items) });
    if (!result) {
      failed = 'Undo failed: try again';
      return;
    }
    if (result.outcome !== 'undone') {
      const reason = typeof result.reason === 'string' ? result.reason : 'someone else already changed this node';
      failed = `Undo skipped: ${reason}`;
      return;
    }
    await refresh();
    const redo = result.redo as Gesture | undefined;
    if (redo) { onAccepted(redo); }
  }

  /**
   * ANNULLARE UNO SPOSTAMENTO NON PASSA DAL SERVER — `moveNode` è last-write-wins, senza
   * `canvas_events`, quindi non c'è un `undo` a cui chiedere: la scrittura è la stessa `move()`
   * ordinaria, verso `before`. LA REGOLA DELL'ALTRO UTENTE È QUI, NON LATO SERVER: `nodes` è già
   * tenuto fresco dal canale realtime (`onChange` → `refresh()`), quindi la posizione ATTUALE che
   * `checkMoveGesture` guarda è quella vera, non quella che questa scheda ricordava. Se un collega
   * ha trascinato lo stesso nodo nel frattempo, la posizione fresca non è più `item.after`, e il
   * gesto — INTERO, non nodo per nodo — si rifiuta con lo stesso messaggio di un rifiuto server.
   */
  async function applyMoveUndo(gesture: MoveGesture, onAccepted: (redo: MoveGesture) => void) {
    const currentOf = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return node ? { x: node.x, y: node.y } : null;
    };

    const check = checkMoveGesture(gesture, currentOf);
    if (check.outcome === 'stale') {
      failed = `Undo skipped: ${check.reason}`;
      return;
    }

    for (const item of gesture.items) {
      await move(item.nodeId, item.before.x, item.before.y);
    }
    onAccepted(inverseMoveGesture(gesture));
  }

  async function undo() {
    const entry = undoStack.popUndo();
    if (!entry) { return; }
    if (entry.source === 'turn') {
      const back = undoTurn(entry.turn);
      if (turnGroup(back)) { undoStack.pushRedo({ source: 'turn', turn: back }); }
      return;
    }
    if (entry.source === 'move') {
      await applyMoveUndo(entry.gesture, (redo) => undoStack.pushRedo({ source: 'move', gesture: redo }));
      return;
    }
    await applyUndo(entry.gesture, (redo) => undoStack.pushRedo({ source: 'server', gesture: redo }));
  }

  async function redo() {
    const entry = undoStack.popRedo();
    if (!entry) { return; }
    if (entry.source === 'turn') {
      const back = undoTurn(entry.turn);
      if (turnGroup(back)) { undoStack.pushUndo({ source: 'turn', turn: back }); }
      return;
    }
    if (entry.source === 'move') {
      await applyMoveUndo(entry.gesture, (redo) => undoStack.pushUndo({ source: 'move', gesture: redo }));
      return;
    }
    await applyUndo(entry.gesture, (redo) => undoStack.pushUndo({ source: 'server', gesture: redo }));
  }

  /**
   * LA FINE DI UN TRASCINAMENTO: `before` viene da `nodes` COSÌ COM'ERA PRIMA di questa funzione
   * toccarlo — `move()`, chiamata dopo, scrive `after` sia sullo schermo che sul server, quindi
   * `before` va letto PRIMA di quel giro, non dentro. Un solo gesto per l'intero trascinamento,
   * anche quando sposta cinque tile insieme: annullarne una sola lascerebbe le altre quattro dove
   * un peer non le ha mai spostate.
   */
  async function moveEnd(moves: { id: string; x: number; y: number }[]) {
    const gesture = buildMoveGesture(
      moves.map((m) => ({ nodeId: m.id, after: { x: m.x, y: m.y } })),
      (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        return node ? { x: node.x, y: node.y } : null;
      }
    );
    if (!gesture) { return; }

    undoStack.push({ source: 'move', gesture });
  }

  /**
   * IL VERSO DI UNA LINEA CHE C'È GIÀ non si corregge: sta su `source_handle`, e cambiarlo vuol
   * dire riscrivere la riga — una funzione che il repository non ha. Finché non c'è, `onEdgeRetype`
   * resta staccato e la linea si toglie e si rifà: un menù che non salva è peggio del menù che
   * manca.
   *
   * I MODELLI ARRIVANO DAL CATALOGO del server (`canvasModelCatalogue`), un menù per medium:
   * il testo è l'intero listino del gateway, immagine e video portano i limiti del modello.
   * «Genera» resta spento finché non c'è chi esegue il giro (fase 3).
   */

  const EMPTY_ORIGIN = { x: 0, y: 0 };
  const CHAT_INPUT = 'chat-composer-input';

  const EMPTY_STARTS: Record<EmptyAction, () => void> = {
    [EmptyAction.Chat]: () => {
      requestChat();
      requestAnimationFrame(() => document.getElementById(CHAT_INPUT)?.focus());
    },
    [EmptyAction.Frame]: () => (frameLibraryAt = EMPTY_ORIGIN),
    [EmptyAction.Image]: () => void create('image', EMPTY_ORIGIN),
    [EmptyAction.Video]: () => void create('video', EMPTY_ORIGIN)
  };

  const canvasMode = $derived(canvasModeFor(data.org.role));
  const viewOnly = $derived(canvasMode === CanvasMode.View);
</script>

<svelte:head><title>feega — {data.canvas.name}</title></svelte:head>

<svelte:window bind:innerWidth={pageWidth} />

<div class="canvas" onpointerover={warmHovered} class:editing={inlineMotion !== null} class:view-only={viewOnly} style={inlineMotion ? neighbourStyle() : undefined}>
  {#if peers.length || canvasPeers.length}
    {#if topPeers}
      <Portal to={topPeers}><PeerAvatars {peers} {following} {presenting} onfollow={(id) => (following = id)} onspotlight={spotlight} /></Portal>
    {:else}
      <div class="peers"><PeerAvatars {peers} {following} {presenting} onfollow={(id) => (following = id)} onspotlight={spotlight} /></div>
    {/if}
  {/if}
  <CursorChat onchat={(chat) => cursors.port.update({ chat })} />
  {#if presenter && following !== presenter.userId}
    <div class="presenting" role="status" data-testid="presenter-prompt">
      {displayName(presenter.name)} is presenting
      <button type="button" onclick={() => (following = presenter.userId)}>Follow</button>
    </div>
  {/if}
  <p class="save-status" role="status" data-status={syncShown.state} aria-label={syncShown.label} title={syncShown.label}></p>
  {#if failed}
    <!-- Un salvataggio perso in silenzio si scopre alla prossima apertura, quando quel che si era
         scritto non c'è più e nessuno sa perché. -->
    <p class="warning" role="alert">
      {failed}
      {#if failedIsCreditsExhausted}
        <a href={BILLING_PATH}>Buy credits</a>
      {/if}
    </p>
  {/if}
  {#if reloadOffered}
    <p class="warning reload" role="status">
      {VERDICT_NOTICE[Verdict.OfferReload]}
      <button type="button" onclick={() => location.reload()}>Reload</button>
    </p>
  {/if}
  {#if workflowRunning}
    <div class="workflow-chip" role="status">
      Workflow running
      <button type="button" onclick={stopWorkflow}>Stop</button>
    </div>
  {/if}

  <RunsPanel runs={runListing} staleCount={staleNodeIds.length} onrunstale={() => runGraph(GraphScope.Stale, staleNodeIds)} />

  {#if formatsFor}
    <FormatsDialog oncreate={(targets) => createFormats(formatsFor!, targets)} onclose={() => (formatsFor = null)} />
  {/if}
  <ConfirmDialog
    bind:open={confirmingUncensoredSwitch}
    title="Uncensored model"
    body="Uncensored models don't accept references. Switching removes the incoming connections and picked references on this node."
    confirmLabel="Switch model"
    cancelLabel="Cancel"
    onConfirm={onUncensoredSwitchConfirmed}
  />

  <ConfirmDialog
    bind:open={confirmingAudioOperationSwitch}
    title="Audio operation"
    body="This operation takes different inputs. Switching removes the incoming connections this node no longer accepts."
    confirmLabel="Switch operation"
    cancelLabel="Cancel"
    onConfirm={onAudioOperationSwitchConfirmed}
  />

  {#if viewOnly}<p class="view-only-badge" data-testid="view-only">View only</p>{/if}
  {#if Flow}
  <Flow
    mode={canvasMode}
    actionUrl={(action: string) => canvasActionUrl({ projectId: data.projectId, canvasId: data.canvas.id }, action)}
    tiles={withPeerMotion(tiles, drawnPeers, new Set(selectedIds))}
    {edges}
    onMove={move}
    onMoveEnd={moveEnd}
    onResize={resize}
    onConnect={connect}
    onDelete={remove}
    onCreateFormats={(id) => (formatsFor = id)}
    onEdgeDelete={disconnect}
    onEdgeModeChange={setEdgeMode}
    onCreate={create}
    onCreateFilled={createFilled}
    onDropOutput={dropOutput}
    onDraw={drawElement}
    onDrawFrame={drawFrame}
    onRotate={rotateGroupBy}
    onGroup={groupElements}
    onUngroup={ungroupElements}
    onRestack={restack}
    onTileDragOver={tileDragOver}
    onTileDrop={tileDrop}
    onFlow={(fn) => (toFlow = fn)}
    onUpload={upload}
    onDuplicate={duplicate}
    onCopy={copy}
    onPaste={paste}
    onTemplate={insertTemplate}
    onFrameTemplates={(at) => (frameLibraryAt = at)}
    onNodeClicked={(id) => (dismissedMotion = dismissedAfterClick(dismissedMotion, id))}
    barContext={barContextOf(inlineMotion ? CanvasState.Editing : CanvasState.Browsing)}
    onUndo={undo}
    onRedo={redo}
    onConnectNew={connectNew}
    {focus}
    onConnectExisting={connectExisting}
    onRunWorkflow={runWorkflow}
    onRunGraph={runGraph}
    stale={staleNodeIds}
    {runQuoteFor}
    onRunNode={runNode}
    {nodeSummaries}
    {modelChoicesFor}
    catalogueSyncedFor={(type) => mediumCatalogue[type].synced}
    onPropertyChange={commonChange}
    onSelectionChange={selectionChanged}
    thumbsOf={sourceThumbs}
    onfail={(why) => {
      console.warn(`[canvas] GPU renderer failed: ${why} → dom`);
      domReason = why;
      Flow = CanvasFlow as unknown as typeof GpuFlow;
    }}
    peers={drawnPeers}
    onPointer={(cursor) => cursors.port.update({ cursor })}
    onLive={(live) => cursors.port.update({ live })}
    onView={(view) => cursors.port.update({ view })}
    onUserPan={() => (following = null)}
    follow={followView}
  >
    {#snippet tileOver({ id })}
      {@const over = liveHost === LiveHost.Canvas ? nodes.find((n) => n.id === id) : null}
      {@const overMotion = over ? motionOf(over) : null}
      {#if overMotion}<FrameLiveControls nodeId={id} interactive={!!overMotion.interactive && tileMode(id, inlineMotion, inlineStage.leaving) === NodeMode.Preview} src={motionLivePath({ projectId: data.projectId, canvasId: data.canvas.id, nodeId: id })} />{/if}
    {/snippet}
    {#snippet tile({ id, selected })}
      {@const row = nodes.find((n) => n.id === id)}
      {#if row}
        {@const gen = genOf(row)}
        {@const frame = frameOf(row)}
        {@const doc = docOf(row)}
        {@const catalog = productsOf(row)}
        {@const feed = socialFeedOf(row)}
        {@const influencer = influencerOf(row)}
        {@const list = listOf(row)}
        {@const select = selectOf(row)}
        {@const effects = effectsOf(row)}
        {@const composition = compositionOf(row)}
        {@const motion = motionOf(row)}
        {@const studioBatch = studioBatchOf(row)}
        {@const estimateRevision = textEstimateRevision(id)}
        {@const textCost = textCostEstimates[id]?.revision === estimateRevision ? textCostEstimates[id] : undefined}
        {@const uploaded = isUploadedNodeRow(row) ? uploadedNodeOf(row) : null}
        {#if uploaded}
          <UploadedNode
            node={{ ...uploaded, url: assetUrl(uploaded.assetId) ?? uploaded.url }}
            medium={row.type === 'video' ? 'video' : 'image'}
            {selected}
          />
        {:else if gen}
          <GenNode
            node={{ ...gen, runs: runsByNode[row.id] ?? [] }}
            choices={mediumCatalogue[gen.medium].choices}
            catalogueSynced={mediumCatalogue[gen.medium].synced}
            enhanceUnitCredits={mediumCatalogue[gen.medium].enhanceUnitCredits}
            estimatedTextInputTokens={textCost?.inputTokens}
            estimatedTextOutputTokens={textCost?.outputTokens}
            variableTextInput={textCost?.variableInput ?? (gen.medium === 'text' && estimateRevision !== '[]')}
            {estimateRevision}
            hasUpstreamText={hasUpstreamTextByNode[row.id] ?? false}
            loopQueued={loopQueuedByNode[row.id] ?? 0}
            loopVisible={loopAffordanceByNode[row.id]?.visible ?? false}
            loopCombinationCount={loopAffordanceByNode[row.id]?.combinationCount ?? 0}
            onchange={(patch) => changeGen(id, gen, patch)}
            onestimate={(prompt, model, revision) => void estimateTextCost(id, prompt, model ?? '', revision)}
            onrun={() => run(id, gen)}
            onrunloop={() => runLoop(id)}
            oncancelloop={() => cancelLoopFor(id)}
            onunlock={() => unlock(id)}
            onshow={(runId) => restore(id, gen, runId)}
            onmeasure={(contentHeight) => (grownHeights[id] = contentHeight)}
            example={exampleFor(row)}
          >
            {#snippet result({ refId, text })}
              <!-- `/c/<tela>/assets/<id>` firma lo storage al volo: un URL firmato messo qui
                   scadrebbe in due ore, e una tela lasciata aperta tutto il giorno mostrerebbe
                   riquadri rotti. -->
              {#if row.data.outputUncensored === true}
                <span class="uncensored-output" data-testid="uncensored-output">Uncensored</span>
              {/if}
              <span class="ai-generated-mark" data-testid="ai-generated-mark">AI-generated</span>
              {#if gen.medium === 'text'}
                <div class="gen-text-wrap">
                  <div class="gen-text-toggle" role="group" aria-label="Vista del testo">
                    <button
                      type="button"
                      class:is-active={textViewModeOf(id) === 'markdown'}
                      onclick={() => setTextViewMode(id, 'markdown')}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      class:is-active={textViewModeOf(id) === 'raw'}
                      onclick={() => setTextViewMode(id, 'raw')}
                    >
                      Raw
                    </button>
                  </div>
                  {#if textViewModeOf(id) === 'markdown'}
                    <div class="gen-text gen-text-md doc-prose nodrag" use:scrollGuard>{@html renderDocHtml(text ?? '')}</div>
                  {:else}
                    <pre class="gen-text nodrag" use:scrollGuard>{text ?? ''}</pre>
                  {/if}
                </div>
              {:else if gen.medium === 'model3d'}
                <Model3dViewer
                  src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`}
                  nodeId={id}
                  poster={typeof row.data.posterRefId === 'string' ? `/p/${data.projectId}/c/${data.canvas.id}/assets/${row.data.posterRefId}` : null}
                  onrender={(views) => renderModelViews(id, views)}
                />
              {:else if gen.medium === 'audio'}
                <AudioResult nodeId={id} {...audioUrlsOf(row)} files={audioFilesOf(row, gen.params.targetLanguage ?? null)} />
              {:else if gen.medium === 'video'}
                <LiveVideo src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} {selected} controls />
                <div class="gen-download">
                  <NodeDownload kind="video" sourceUrl={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} nodeType={gen.medium} origin={MediaOrigin.Generated} />
                </div>
              {:else}
                <TieredImage src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} alt={gen.prompt} />
                <div class="gen-download">
                  <NodeDownload kind="image" sourceUrl={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} nodeType={gen.medium} origin={MediaOrigin.Generated} />
                </div>
              {/if}
            {/snippet}
            {#snippet references()}
              {#if gen.medium === 'audio'}
                <AudioControls
                  node={gen}
                  {voices}
                  {voicesError}
                  custom={customVoices}
                  slots={voiceSlots}
                  cloningAllowed={data.mode !== 'uncensored'}
                  onvoiceaction={voiceAction}
                  onvoiceschanged={() => void loadVoices()}
                  onparams={(params) => changeGen(id, gen, { params })}
                  onmodel={(model) => changeGen(id, gen, { model })}
                  onoperation={(next) => void changeAudioOperation(id, gen, next)}
                  onloadvoices={() => void loadVoices()}
                />
              {:else}
              <NodeReferences
                references={referencesOf(row.data)}
                catalogue={data.references.catalogue}
                media={data.references.media}
                assetUrl={(assetId) => sized(`/p/${data.projectId}/c/${data.canvas.id}/assets/${assetId}`, AssetSize.Thumb)}
                onchange={(next) => void write(id, { references: next })}
              />
              {/if}
            {/snippet}
          </GenNode>
        {:else if frame}
          <IframeNode node={frame} onchange={(patch) => write(id, frameData({ ...frame, ...patch }))} />
        {:else if doc}
          <DocNode
            node={doc}
            onchange={(patch) => write(id, docData({ ...doc, ...patch }))}
            onshare={(on) => share(id, on)}
          />
        {:else if catalog}
          <SourceSettingsFrame
            {selected}
            view={selected ? inspectorOf(row) : null}
            shown={shownProducts[id]?.length ?? 0}
            onfield={(patch) => write(id, patch)}
            onsync={() => sync(id)}
          >
            <ProductsNode node={catalog} products={shownProducts[id] ?? []} total={products[id]?.length ?? 0} />
          </SourceSettingsFrame>
        {:else if feed}
          <SourceSettingsFrame
            {selected}
            view={selected ? inspectorOf(row) : null}
            shown={shownPosts[id]?.length ?? 0}
            onfield={(patch) => write(id, patch)}
            onsync={() => sync(id)}
          >
            <SocialFeedNode node={feed} posts={shownPosts[id] ?? []} total={socialPosts[id]?.length ?? 0} />
          </SourceSettingsFrame>
        {:else if influencer}
          <InfluencerNode
            name={influencersByNode[id]?.name ?? 'Influencer'}
            views={influencersByNode[id]?.views ?? []}
          />
        {:else if list}
          <ListNode
            node={list}
            values={listValuesByNode[id]}
            onchange={(patch) => write(id, listData({ ...list, ...patch }))}
            onretry={loopOutputByNode[id] ? (index) => retryLoopItem(id, list, loopOutputByNode[id]!, index) : undefined}
          />
        {:else if select}
          <SelectNode
            node={select}
            list={upstreamListOf(id)}
            outputs={selectOutputsOf(row)}
            values={selectValuesOf(row) ?? {}}
            sourceType={selectSourceOf(id)?.type ?? null}
            preview={(field) => selectFieldPreview(id, select.index, field)}
            onchange={(patch) => write(id, selectData({ ...select, ...patch }))}
          />
        {:else if effects}
          {@const effectsInput = upstreamEffectsMediaOf(id)}
          <EffectsNode
            node={{ ...effects, mediaKind: effectsInput?.kind ?? effects.mediaKind }}
            imageUrl={assetUrl(effects.refId)}
            sourceImageUrl={assetUrl(effectsInput?.refId ?? effects.sourceRefId)}
            inputChanged={inputChanged(effects.sourceRefId, effectsInput?.refId ?? null)}
            onopeneditor={() => (effectsEditorId = id)}
            onpair={hasCutout(effects.effects) && effectsInput && !cutoutTwin(id, edges, nodes) ? () => makePair(id) : undefined}
          />
        {:else if composition}
          {@const cards = compositionCards(id, edges, nodes)}
          <CompositionNode
            node={composition}
            posterUrl={assetUrl(composition.refId)}
            {cards}
            assets={cardAssets(cards)}
            composeIn={{ project: data.projectId, canvas: data.canvas.id }}
            templates={data.componentTemplates}
            onpatch={(patch) => write(id, patch, SaveTiming.Now)}
            onpickcomponent={() => (componentPickFor = id)}
          />
        {:else if row.type === PENDING_FRAME_TYPE}
          {@const look = catalogPosters.get(id)}
          <div class="pending-frame" class:shown={look} data-testid="motion-node-pending" aria-busy="true">{#if look}<img src={look} alt="" draggable="false" />{/if}</div>
        {:else if motion}
          {@const motionAt = { projectId: data.projectId, canvasId: data.canvas.id, nodeId: id }}
          <MotionNode node={motion} href={motionEditorPath(motionAt)} previewUrl={motionPreviewPath(motionAt)} posterUrl={(posterFresh(motion) ? assetUrl(motion.posterAssetId) : null) ?? (ghostShown(motion) ? catalogPosters.get(id) : null) ?? null} nodeMode={tileMode(id, inlineMotion, inlineStage.leaving)} onenter={() => requestMotion(id)} {liveHost} liveUrl={motionLivePath(motionAt)} />
        {:else if studioBatch}
          <StudioBatchNode node={studioBatch} projectId={data.projectId} onpick={(batchId) => write(id, newStudioBatchData(batchId), SaveTiming.Now)} />
        {:else if isNodeType(row.type)}
          <EmptyNode type={row.type} />
        {/if}
      {/if}
    {/snippet}
  </Flow>
  {/if}
  {#if dev && domReason}
    <RendererBadge renderer="dom" reason={domReason} />
  {/if}
  {#if !viewOnly && showsEmptyState(nodes.length, inlineMotion)}
    <EmptyCanvas onaction={(action) => EMPTY_STARTS[action]()} />
  {/if}
  {#if editingMotion}
    {#key editingMotion}
      <InlineMotionEditor projectId={data.projectId} canvasId={data.canvas.id} nodeId={editingMotion} revision={headRevisionOf(editingMotion)} leaving={editingMotion !== inlineMotion} onclose={() => (dismissedMotion = editingMotion)} onframe={(free) => reframe(editingMotion, free)} onmoveout={moveOut} onhostdrag={hostDrag} {canvasundo} />
    {/key}
  {/if}

  {#if componentPicking}
    {@const pickingId = componentPicking.id}
    {@const pickingAssets = cardAssets(compositionCards(pickingId, edges, nodes))}
    {@const wiredAssets = Object.entries(pickingAssets).map(([assetId, previewUrl], i) => ({ id: assetId, kind: AssetKind.Image, label: `Input ${i + 1}`, previewUrl }))}
    <ComponentLibrary
      items={componentItems}
      format={FORMAT_OF_ASPECT[componentPicking.aspect]}
      draftOf={(templateId, format) => componentDraft(pickingId, templateId, format)}
      compose={(doc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: pickingAssets, target: Target.Screen })}
      assets={wiredAssets}
      target={AddTarget.Composition}
      onpick={(templateId, _sounds, draft) => pickComponent(pickingId, templateId, draft)}
      onclose={() => (componentPickFor = null)}
    />
  {/if}

  {#if frameLibraryAt}
    <ComponentLibrary
      items={componentItems}
      format={MotionFormat.Landscape}
      draftOf={frameDraft}
      compose={(doc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: frameMediaUrls, target: Target.Screen })}
      assets={frameMedia}
      upload={uploadFrameMedia}
      target={AddTarget.Canvas}
      onpick={(templateId, _sounds, draft) => void addFrame(templateId, draft)}
      onclose={() => (frameLibraryAt = null)}
    />
  {/if}

  {#if effectsEditing}
    {@const editingId = effectsEditing.id}
    {#key editingId}
      <EffectsEditor
        initialSteps={effectsEditing.effects}
        inputUrl={assetUrl(upstreamEffectsMediaOf(editingId)?.refId ?? null)}
        inputKind={upstreamEffectsMediaOf(editingId)?.kind ?? 'image'}
        onapply={(steps, output) => applyEffects(editingId, steps, output)}
        onclose={() => (effectsEditorId = null)}
      />
    {/key}
  {/if}


  {#if coachOpen}
    <OnboardingCoach
      step={coachStep}
      chain={coachChain}
      busy={coachBusy}
      onrun={() => void coachRun()}
      ongenerate={() => void coachGenerate()}
      ondismiss={() => void coachDismiss()}
    />
  {/if}
</div>

<style>
  .view-only :global(.svelte-flow__node) {
    pointer-events: none;
  }

  .view-only-badge {
    position: absolute;
    top: var(--ui-space-3);
    left: 50%;
    z-index: 5;
    margin: 0;
    padding: var(--ui-space-1) var(--ui-space-3);
    border-radius: 9999px;
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    transform: translateX(-50%);
  }

  .canvas.editing :global([role='toolbar'][aria-label='Selection actions']) {
    display: none;
  }

  @media (max-width: 767px) {
    .canvas.editing :global(.svelte-flow__node:not(:has([data-testid='motion-node-editing']))) {
      opacity: var(--neighbour-body);
    }

    .canvas.editing :global(.svelte-flow__edge) {
      opacity: var(--neighbour-edges);
    }

    .canvas.editing :global(.svelte-flow__node:not(:has([data-testid='motion-node-editing'])) .node-label) {
      opacity: var(--neighbour-label);
    }

    .canvas.editing :global(.svelte-flow__node:not(:has([data-testid='motion-node-editing'])) .svelte-flow__handle) {
      opacity: var(--neighbour-ports);
    }
  }

  .pending-frame {
    width: 100%;
    height: 100%;
    background: var(--muted);
    animation: pending-pulse 1.2s ease-in-out infinite alternate;
  }

  .pending-frame.shown {
    background: none;
    animation: none;
  }

  .pending-frame img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @keyframes pending-pulse {
    to {
      opacity: 0.5;
    }
  }

  .canvas {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .gen-download {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 5;
  }

  .gen-text-wrap {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .gen-text-toggle {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
  }
  .gen-text-toggle button {
    flex: 1;
    padding: 4px 8px;
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: 10.5px;
    font-weight: 550;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .gen-text-toggle button.is-active {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink, #1d1d1f);
  }
  .gen-text-toggle button + button {
    border-left: 1px solid var(--line, #e5e5e5);
  }

  .gen-text {
    flex: 1;
    width: 100%;
    min-height: 0;
    margin: 0;
    padding: 12px;
    overflow: auto;
    white-space: pre-wrap;
    font: inherit;
  }
  .gen-text-md {
    white-space: normal;
    font-size: 12px;
  }
  .gen-text-md :global(> :first-child) {
    margin-top: 0;
  }
  .gen-text-md :global(> :last-child) {
    margin-bottom: 0;
  }

  .presenting { position: absolute; z-index: 10; left: 50%; top: 16px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; padding: 6px 12px; background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: 9999px; font-size: 13px; }
  .presenting button { border: 0; background: var(--ui-accent, #0090ff); color: white; border-radius: 9999px; padding: 2px 10px; cursor: pointer; }
  .peers { position: absolute; z-index: 10; right: 16px; top: 16px; }

  .save-status {
    position: absolute;
    z-index: 10;
    left: 16px;
    bottom: 16px;
    width: 6px;
    height: 6px;
    margin: 0;
    border-radius: 9999px;
    background: var(--muted-foreground, #888);
    opacity: 0;
    transition: opacity 300ms ease;
  }

  .save-status:not([data-status='saved']) { opacity: 0.8; }

  .save-status[data-status='offline'] { background: #d4a017; }

  @media (max-width: 767px) {
    .save-status { bottom: var(--mobile-switch-bottom, 16px); }
  }

  .save-status[data-status='retrying'] { background: #c0392b; }

  .warning {
    position: absolute;
    z-index: 10;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 4px 10px;
    font-size: 12px;
    color: #c0392b;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
  }

  .warning.reload {
    top: 40px;
    color: inherit;
  }

  .workflow-chip {
    position: absolute;
    z-index: 10;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
  }
  .workflow-chip button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    text-decoration: underline;
    cursor: pointer;
  }
  .ai-generated-mark {
    position: absolute;
    bottom: 6px;
    left: 6px;
    z-index: 2;
    padding: 0 4px;
    font-size: 0.625rem;
    line-height: 1rem;
    color: var(--paper, #fff);
    background: rgb(0 0 0 / 0.6);
    pointer-events: none;
  }
  .uncensored-output {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;
    padding: 0 4px;
    font-size: 0.625rem;
    line-height: 1rem;
    color: var(--color-destructive);
    background: var(--color-background);
    border: 1px solid var(--color-destructive);
  }
</style>
