<script lang="ts">
  import { baseNodeId, heldViews, viewAt, viewOf } from '$lib/canvas/breakpoint-views';
  import { liftViewEdit } from '@feega/motion-core/motion/breakpoints/view';
  import { BASE_BREAKPOINT } from '@feega/motion-core/motion/breakpoints/model';
  import { ownsPress } from '$lib/canvas/press-owner';
  import { pressMenu } from '$lib/motion/press-menu';
  import { cardRadiusOf } from '$lib/canvas/core/gen-card';
  import { LocalOff, isOff } from '$lib/local-user';
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import { frameDrill } from '$lib/canvas/frame-drill';
  import { Depth, Gesture } from '$lib/motion/drill';
  import { FrameFit, FramePickers, Reuse, type WorldRect } from '$lib/canvas/frame-pick';
  import { PickerSettle } from '$lib/canvas/picker-settle.svelte';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { lockOverscroll } from './overscroll-lock';
  import { TILE_PAINTED } from '@feega/motion-core/motion/hyperframes/measure';
  import { NODE_TYPES, isNodeType, type NodeType } from '$lib/canvas/node-data';
  import { page } from '$app/state';
  import FrameOverlays from '../FrameOverlays.svelte';
  import PrototypeArrows from '../PrototypeArrows.svelte';
  import PrototypePlayerHost from '../PrototypePlayerHost.svelte';
  import { prototypePlayer } from '$lib/canvas/prototype-player.svelte';
  import { prototypeLink } from '$lib/canvas/prototype-link.svelte';
  import { prototypeLinks } from '$lib/motion/prototype/links';
  import { linkToFrame } from '$lib/motion/prototype/link-draft';
  import { HighlightKind, highlightOf, highlightStyle } from '$lib/canvas/highlight';
  import { tileFaded } from '$lib/canvas/tile-opacity';
  import { canRunInFrame, barAction, barActionLater, elementMenuIds, frameKeyAction, frameMenuAction, picksFor, wholeElementAction, ElementAction } from '$lib/canvas/frame-inspector';
  import { Action, type ActionId } from '$lib/motion/actions';
  import { letteringOf } from '$lib/motion/text-outline-run';
  import { frameLayers, frameMenuRun, frameSummaries } from '$lib/motion/frame-menu';
  import FrameSelection from '../FrameSelection.svelte';
  import FrameGuides from '../FrameGuides.svelte';
  import FrameTools from '../FrameTools.svelte';
  import { FrameView, contentViews } from '$lib/canvas/frame-view';
  import { frameViews, zoomLevel, zoomRequest } from '$lib/canvas/view-menu.svelte';
  import type { Boxes } from '$lib/motion/scene-select';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { findClip, type MotionClip } from '@feega/motion-core/motion/doc';
  import { TRANSFORM } from '@feega/motion-core/motion/keyframes';
  import CoreTextEdit from '../CoreTextEdit.svelte';
  import GradientHandles from '../GradientHandles.svelte';
  import CropHandles from '../CropHandles.svelte';
  import { styleLibrary } from '$lib/canvas/style-library.svelte';
  import { sameValue } from '$lib/canvas/node-patch';
  import { projectLibraryStore } from '$lib/canvas/project-library-store';
  import { LibraryKind } from '$lib/motion/project-library-ops';
  import { libraryOf, syncedDoc } from '$lib/motion/style-library';
  import { removeStyle, renameStyle } from '$lib/motion/styles';
  import { variableLibrary } from '$lib/canvas/variable-library.svelte';
  import { syncedCollection, variableLibraryOf } from '$lib/motion/variable-library';
  import { removeVariable } from '$lib/motion/variables';
  import type { Collection } from '@feega/motion-core/motion/variables-model';
  import type { Style } from '@feega/motion-core/motion/styles-model';
  import { gradientTarget, withFill } from '$lib/canvas/gradient-handles';
  import { imageTarget } from '$lib/canvas/crop-handles';
  import { cropRequest } from '$lib/canvas/crop-request.svelte';
  import { ImageTool } from '$lib/image-tools';
  import type { FillOf, FillType } from '@feega/motion-core/motion/fill/model';
  import type { Fill } from '@feega/motion-core/motion/fill/model';
  import { baseStyle, editBody, editLayout, editsText, hideText, listsOfClip, runsOfClip, styledKind, textEditStyle, type EditBody, type TextEditStyle } from '$lib/canvas/frame-text-edit';
  import { caretSource } from '$lib/canvas/core/text-caret';
  import { applyTextFit, measuredTexts } from '$lib/canvas/text-autosize';
  import { HostLedger, settleElement, type ElementHost, type HostBox } from '$lib/motion/element-host';
  import type { TextCaret } from '@feega/motion-core/motion/gpu-full/display-list';
  import type { RunStyle, TextRun } from '@feega/motion-core/motion/text-runs';
  import type { ListItem } from '@feega/motion-core/motion/text-lists';
  import { frameProperties, UNNAMED_FRAME, type NodePlace } from '../frame-properties.svelte';
  import { selectionProperties } from '../selection-properties.svelte';
  import { trailerFrom } from '$lib/motion/trailer';
  import FrameDialogs from '../FrameDialogs.svelte';
  import FramePeers from '$lib/components/motion/FramePeers.svelte';
  import RemixBanner from '$lib/components/gallery/RemixBanner.svelte';
  import { FramePeering, peerBoxes } from '$lib/canvas/frame-peering.svelte';
  import { framePresence } from '$lib/realtime/frame-presence';
  import { handoffPath } from '$lib/canvas/chat-handoff';
  import { BRAND_REMIX_PROMPT } from '$lib/gallery/model';
  import { goto } from '$app/navigation';
  import { FrameExtras } from '$lib/canvas/frame-extras.svelte';
  import { historyPanel } from '$lib/canvas/history-panel.svelte';
  import { FRAME_DIALOG_ACTIONS, FRAME_MODE_ACTIONS, FrameDialog, isFrameDialogAction, isFrameModeAction } from '$lib/canvas/frame-dialogs';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import type { ExportRow } from '$lib/motion/export-rows';
  import { Extend, Press, Reach, Root, childBelow, extendOf, framePage, pressOn, frameLevel, grabbedInstead, ownClipOf, ownClipToPick, stepInside, videoSide, type Inside } from '$lib/canvas/frame-select';
  import { holdsLock, ownLocked } from '$lib/canvas/locks';
  import { altCopies } from '$lib/canvas/alt-copy';
  import { clickPick, pickTarget, reachOf, enteredFrom, parentPick, scopeOf, scoped } from '$lib/canvas/frame-scope';
  import { pastedInFrame, type FramePaste } from '$lib/canvas/frame-paste';
  import { ImagesOutcome, figmaImageAssets, type ImagesAnswer } from '$lib/canvas/figma/fetch-images';
  import { imagesFilled, type FigmaJob } from '$lib/canvas/figma/images';
  import { quadBox, quadStyle } from '$lib/canvas/quad-box';
  import { DocAccess, FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import { nextDoc, stepOf, type PeerStep } from '$lib/motion/frame-step';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { GRIP_SUMMARY, SelectionKind, SnapMode, dragClips, measuredGaps, nudgeClips } from '$lib/canvas/frame-transform';
  import { unionBounds } from '$lib/motion/multi-select';
  import { marqueeIds, primaryOf, spanOf, toggleId, type FrameStep } from '$lib/canvas/frame-multi';
  import { postPageAction } from '$lib/api/page-action';
  import { Grip, handlesOf, type Gap, type Guide, type Pt, type Quad } from '$lib/motion/scene-select';
  import { copyElements, guessedBoxes } from '$lib/motion/move-element';
  import { PENDING_ASSET, imageInFrame, sizeOfImage, withAssetSwapped } from '$lib/canvas/image-in-frame';
  import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
  import { stackFrame, stackPlaced } from '$lib/motion/layout/ops';
  import { dragInStack, dropInStack, followCursor, type DropLine } from '$lib/motion/layout/stack-drag';
  import { frameOfLive } from '$lib/canvas/core/frame-source';
  import { commitScoped, doubledOn, textScope } from '$lib/canvas/scoped-text';
  import { mul2d } from '@feega/motion-core/motion/parent';
  import { EditMode, readMode, timelineDoc } from '$lib/motion/edit-mode';
  import { CanvasLines, EditorMode, ModeInspector, TimelineAccess, editorMode, frameTimeline } from '$lib/canvas/editor-mode.svelte';
  import { BarTab, rightBar } from '$lib/components/brand-agent/right-bar-host.svelte';
  import { elementKey } from '$lib/canvas/prototype-arrows';
  import type { PrototypeLink } from '$lib/motion/prototype/links';
  import { withPlayhead } from '$lib/canvas/frame-playhead';
  import { msOfFrame, type CommentMark } from '$lib/canvas/comment-marks';
  import FrameTimeline from '../FrameTimeline.svelte';
  import type { FlowProps, Tile } from '../flow-types';
  import { CopyShown, type Drawing } from '$lib/canvas/optimistic-insert';
  import { drawnAnchor, drawnInFrame } from '$lib/canvas/canvas-draw';
  import { TypeAhead } from '$lib/canvas/type-ahead';
  import { DRAW_SUMMARY, drawStart, type DrawnWire } from '$lib/motion/draw-create';
  import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
  import { frameDocs, type FrameDocEdit, type HeldDoc } from '$lib/canvas/frame-docs';
  import './flow-base.css';
  import CanvasAddBar from '../CanvasAddBar.svelte';
  import CanvasDrawLayer from '../CanvasDrawLayer.svelte';
  import { COLOUR_TAG_HEX, colourOf } from '$lib/canvas/node-colour';
  import { CloudMode } from '$lib/canvas/cloud-picker';
  import SelectionToolbar from '../SelectionToolbar.svelte';
  import NextStepChips from '../NextStepChips.svelte';
  import CanvasContextMenu from '../CanvasContextMenu.svelte';
  import CommandPalette from '../CommandPalette.svelte';
  import ConnectPicker from '../ConnectPicker.svelte';
  import PageZoomLock from '../PageZoomLock.svelte';
  import NodeBoundary from '../NodeBoundary.svelte';
  import EdgePanel from '../EdgePanel.svelte';
  import GpuTileChrome from './GpuTileChrome.svelte';
  import CoreFrames from './CoreFrames.svelte';
  import type { FrameRange } from '@feega/motion-core/motion/gpu-full/ram-preview';
  import { sceneRevision, sceneStamp } from '$lib/canvas/scene-sources';
  import { liveDocs, type LiveDoc } from '$lib/canvas/core/live-docs.svelte';
  import { missingAssets } from '$lib/canvas/live-assets';
  import { statePreview } from '$lib/canvas/state-preview.svelte';
  import { previewDoc } from '$lib/motion/states/preview';
  import { instanceOf } from '$lib/motion/main-component';
  import { appendVariant } from '$lib/motion/variants';
  import VariantPlus from '../VariantPlus.svelte';
  import ComponentSetOutline from '../ComponentSetOutline.svelte';
  import { addSetVariant, mainDragged, setMainOf } from '$lib/motion/component-set';
  import { COMPONENTS_PAGE } from '$lib/canvas/components-page';
  import { canvasComponents } from '$lib/canvas/canvas-components.svelte';
  import { CANVAS_DRAG_COMPONENT, parseComponentClip, parseComponentDrag, type ComponentDrag } from '$lib/canvas/component-drag';
  import { ComponentDropOn, componentDropTarget } from '$lib/canvas/component-drop';
  import { fetchComponentSource } from '$lib/canvas/project-components';
  import { homed, mainClipOf, placeInstance } from '$lib/motion/canvas-components';
  import { CardLayer, cardKey, cardsOnCanvas, portMarks, ringColour, type CardTile } from '$lib/canvas/core/card-source';
  import { coreText, type CoreText } from './core-text';
  import { NodeChrome, nodeChrome } from '$lib/canvas/selection-chrome';
  import { editableIds } from '$lib/canvas/frame-live';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { elementGlyph } from '$lib/canvas/layers';
  import { imageSourceTile } from '$lib/canvas/free-image';
  import { frameRinged } from '$lib/canvas/layers';
  import { framesOnCanvas, sameLive, toFetch, type FrameAt } from '$lib/canvas/core/frame-source';
  import { ChromeLayers, NO_OVERLAY, overlayOf } from '$lib/canvas/core/world-overlay';
  import { labelZoomStep, strokeZoomStep } from '$lib/canvas/core/label-size';
  import { nodeHitRects } from '$lib/canvas/core/node-hit';
  import type { ChromeTile, Glyphs } from '$lib/canvas/core/chrome';
  import { peerOutlines } from '$lib/canvas/peer-outlines';
  import { displayName } from '$lib/realtime/frame-presence';
  import Repeat from '@lucide/svelte/icons/repeat';
  import PeerLayer from '../PeerLayer.svelte';
  import { centreOf, viewportCentredOn } from '$lib/realtime/canvas-presence';
  import { setTileLive } from '$lib/canvas/tile-live-context';
  import { FrameKind, MOTION_NODE_BAR_H, TileBody, docKindOf, frameChrome, holdsDoc, ResizePaint, leftEmpty } from '$lib/canvas/motion-node';
  import { barContextFor } from '$lib/canvas/bottom-bar';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { CANVAS_MODES, CanvasMode } from '$lib/canvas/canvas-mode';
  import { FitPurpose, fitView, restoreViewport } from '$lib/canvas/restore-viewport';
  import { loadViewport, rememberViewport } from '$lib/canvas/viewport-memory';
  import { FocusMode, Placement, centreIn, focusPlacement, focusSelects, inView, revealIn, frameIn, type Insets } from '$lib/canvas/free-area';
  import { ZoomStep, watchPinch, type CanvasZoom } from '$lib/canvas/page-zoom';
  import { Region, keyRegion } from '$lib/canvas/key-region.svelte';
  import { shortcutHelp } from '$lib/canvas/shortcut-help.svelte';
  import { CANVAS_COMMAND_OF, climbsUp, matchCanvasShortcut, preventable, type CanvasCommand } from '$lib/canvas/shortcuts';
  import type { Command } from '$lib/motion/shortcuts';
  import { HTML_MIME, Pasted, TEXT_MIME, clipboardHtml, readPaste, type ClipboardPayload, type PasteData, type PasteSource } from '$lib/canvas/system-clipboard';
  import { eventSource, systemSource, writeSystem } from '$lib/canvas/system-clipboard-browser';
  import { elementClipboard } from '$lib/canvas/element-clipboard.svelte';
  import { isTypingTarget } from '$lib/shortcuts';
  import { Stack } from '$lib/canvas/stacking';
  import { NodeFlag } from '$lib/canvas/node-flags';
  import { Carry, DragPhase, DropVerdict, carryOf, frameUnderPointer, pastSlop, pointOf, type ElementOut } from '$lib/canvas/canvas-drop';
  import { sceneDrop } from '$lib/canvas/scene-drop';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { CANVAS_DRAG_FILLED_NODE, CANVAS_DRAG_OUTPUT, parseFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { CANVAS_DRAG_FEED_IMAGE, parseFeedImageDrag } from '$lib/canvas/feed-image';
  import { isAddable, type Addable } from '$lib/canvas/addable';
  import { hotDrag, hotTiles } from '$lib/canvas/hot-models';
  import { edgeKindsFor } from '$lib/canvas/connect-rules';
  import { connectionRefusal, landingOf, type Connection } from '$lib/canvas/connection-verdict';
  import { focusEdges } from '$lib/canvas/edge-focus';
  import { reportHref } from '$lib/reports/report-link';
  import { GraphScope } from '$lib/canvas/run-graph';
  import { ALIGN_ACTIONS, ALIGN_EDGE, canvasMenuIds, enabledFor, isCanvasAction, shownFor, type AlignActionId, type CanvasActionId, type SelectionActionId } from '$lib/canvas/selection-actions';
  import { DeleteMode, SECTION_TYPE } from '$lib/canvas/section';
  import { STACK_GAP, alignTiles, alignWithin, distributeTiles, stackTiles, tidyTiles, type TileMove } from '$lib/canvas/align';
  import { tilesAt } from '$lib/canvas/tiles-at';
  import { tileGaps } from '$lib/canvas/measure';
  import { snapDrag, snapResize, type SnapGuide, type SpacingGap } from '$lib/canvas/snap';

  import { dragOffset, type Offset } from '$lib/canvas/duplicate-plan';
  import { enterSelected } from '$lib/canvas/enter-frame';
  import { Direction, siblingOf } from '$lib/motion/siblings';
  import { alignSpace, propBoxes, type Edge } from '$lib/motion/space';
  import MeasureLayer from '../MeasureLayer.svelte';
  import type { GenPropertyType } from '$lib/canvas/common-properties';
  import type { GenMedium } from '$lib/canvas/gen-node';
  import type { CanvasEdgeKind, FlowEdge, WireMode } from '$lib/canvas-edges';
  import { setTileRender } from '$lib/canvas/tile-render-context';
  import { resizeCursor, rotateCursor } from '$lib/canvas/resize-cursor';
  import { setTileResize } from '$lib/canvas/tile-resize-context';
  import { setTileRotate } from '$lib/canvas/tile-rotate-context';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { commentPlacement, type CommentPlacement } from '$lib/canvas/comment-placement';
  import { panBy, toWorld, visibleIds, zoomAt, type Point } from '$lib/canvas/gpu/camera';
  import { isLiveCode } from '$lib/canvas/code-frame';
  import { PORT_OFFSET, PortSide, edgeAt, portAt, portsOf, resizeHandleAt, wireCurve, type Box, type Port } from '$lib/canvas/gpu/geometry';
  import { GestureKind, HitKind, Pointer, clicked, gestureFor, glidesAfterPan, marqueeBox, marqueePick, movedBy, resizedAt, rotateZoneAt, type Hit } from '$lib/canvas/gpu/gesture';
  import { faceOf } from '$lib/canvas/gpu/card-face';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { assetTier } from '$lib/canvas/core/asset-tier';
  import { Fling, type Glide } from '$lib/canvas/core/inertia';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import { themeOf } from '$lib/canvas/gpu/theme';
  import { exposeReveal, exposeSettled } from '$lib/canvas/gpu/frame-stats';
  import { currentDevice } from '$lib/canvas/gpu/memory-budget';
  import type { GenTileView } from '$lib/canvas/gen-tile-view';
  import type { NodeView } from '$lib/canvas/node-view';
  import { isRunning } from '$lib/canvas/gpu/snapshot-queue';
  import { revealIn as revealDelay } from '$lib/canvas/gpu/reveal-gate';
  import { CANVAS_LOAD_EVENT, LoadKind, claimLoad, loadTiming } from '$lib/canvas/gpu/load-timing';
  import { engineOf } from '@feega/motion-core/motion/engine';
  import { track } from '$lib/analytics';
  import { NODE_KIND_LABEL, NameTag } from '$lib/canvas/node-label';
  import { dragAngle, followGroup, mirrorGroup, type Placed } from '$lib/canvas/node-layout';
  import { Flip, flipStage } from '$lib/motion/layer-props';
  import { scaledTo, selectionBox, turnedAbout, withField } from '$lib/canvas/selection-box';

  let props: FlowProps & { viewOf?: (id: string) => NodeView | null; genViewFor?: (id: string) => GenTileView | null; onRename?: (id: string, name: string) => void; onExportRows?: (frameIds: string[], rows: ExportRow[]) => Promise<{ url: string; name: string; files: string[] } | string>; tileOver?: import('svelte').Snippet<[{ id: string; body: TileBody }]>; canvasOver?: import('svelte').Snippet; onClip?: (ids: string[]) => ClipboardPayload | null; onPasteData?: (data: PasteData<File>, at: Point) => void; viewerId?: string; canvasId?: string; figmaJobs?: FigmaJob[]; onFigmaImages?: (answer: ImagesAnswer) => void; onFigmaPaste?: (paste: { skipped: string[]; images: number; loading: boolean }) => void; onfail?: (message: string) => void; onExportElements?: (frameId: string, elementIds: string[]) => void; onExportElementRows?: (frameId: string, elementIds: string[], rows: ExportRow[]) => Promise<{ url: string; name: string; files: string[] } | string>; onFrameStep?: (step: FrameStep) => void; commenting?: boolean; onCommenting?: (on: boolean) => void; onComment?: (at: CommentPlacement) => void; commentMarks?: (nodeId: string, fps: number) => CommentMark[]; onMark?: (id: string) => void; onPinAtPlayhead?: (nodeId: string, timeMs: number) => void } = $props();

  const DOM_CAP = 6;
  const HALF = 2;
  const CORE = 'core';
  const LABEL_CLEARANCE = 24;
  const WHEEL_ZOOM = 0.01;
  const STEP_ZOOM = 1.2;
  const FIT_MS = 250;
  const EDIT_MAX_ZOOM = 2;
  const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable="true"], .nodrag, video, audio, iframe';

  const tiles = $derived(props.tiles ?? []);
  const mode = $derived(props.mode ?? CanvasMode.Edit);
  const spec = $derived(CANVAS_MODES[mode]);
  const editable = $derived(spec.flow.nodesDraggable && editorMode.spec.access === DocAccess.Write);
  const connectable = $derived(spec.flow.nodesConnectable && editorMode.spec.access === DocAccess.Write);

  setTileRender(() => props.tile);
  setTileResize(() => props.onResize);
  setTileRotate(() => props.onRotate);
  setTileLive(() => props.onLive);

  let wrap = $state<HTMLDivElement | null>(null);
  let surface = $state<HTMLDivElement | null>(null);
  let failed = $state<string | null>(null);
  let view = $state<Viewport>({ x: 0, y: 0, zoom: 1 });

  $effect(() => {
    const at = view;
    untrack(() => props.onView?.(centreOf(at, screenSize())));
  });

  $effect(() => {
    const target = props.follow;
    if (target) {
      view = viewportCentredOn(target, untrack(() => screenSize()));
    }
  });
  let area = $state({ width: 0, height: 0 });
  let selected = $state<string[]>([]);
  let selectedEdge = $state<string | null>(null);
  let hovered = $state<string | null>(null);
  let addLinger = $state<string | null>(null);
  let addLingerTimer: ReturnType<typeof setTimeout> | undefined;
  const ADD_LINGER_MS = 600;

  $effect(() => {
    const now = hovered;
    clearTimeout(addLingerTimer);
    if (now) {
      addLinger = now;
      return;
    }
    addLingerTimer = setTimeout(() => (addLinger = null), ADD_LINGER_MS);
    return () => clearTimeout(addLingerTimer);
  });
  let pickHover = $state<{ nodeId: string; clip: string; quad: Point[]; at: string; highlight: HighlightKind } | null>(null);
  let overrides = $state<Map<string, Box>>(new Map());
  let copies = $state<Map<string, Box>>(new Map());
  let marquee = $state<Box | null>(null);
  let ghost = $state<{ from: Port; at: Point; ok: boolean } | null>(null);
  let refusal = $state<string | null>(null);
  let menuAt = $state<Point | null>(null);
  let picked = $state<{ edge: FlowEdge; screen: Point } | null>(null);
  let connectPickerAt = $state<Point | null>(null);
  let targeting = $state<string[] | null>(null);
  let space = $state(false);
  let gesturing = $state(false);
  let resizing = $state<ReadonlySet<string>>(new Set());
  let fitted = false;
  let fittedCanvas = '';
  let known = new Set<string>();

  const assetUrl = (id: string) => canvasAssetUrl(page.params.projectId ?? '', page.params.canvasId ?? '', id, AssetSize.Full);
  const tier = $derived(assetTier(view.zoom));
  const tierUrl = (id: string) => canvasAssetUrl(page.params.projectId ?? '', page.params.canvasId ?? '', id, tier);

  let turning = $state<ReadonlyMap<string, number>>(new Map());
  let spin = $state<{ box: Box; degrees: number } | null>(null);
  const placed = $derived([...tiles.filter((t) => t.behind), ...tiles.filter((t) => !t.behind)].map((t) => imageSourceTile({ ...t, ...(overrides.get(t.id) ?? {}), ...(turning.has(t.id) ? { rotation: turning.get(t.id) } : {}) }, liveOf(t.id)?.doc ?? null)));
  const byId = $derived(new Map(placed.map((t) => [t.id, t])));
  const summaries = $derived(new Map((props.nodeSummaries ?? []).map((n) => [n.id, n])));
  const ports = $derived(placed.flatMap((t) => portsOf(t)));
  const nodeOf = $derived(new Map(placed.filter((t) => t.node).map((t) => [t.id, t.node!])));
  const lookup = (id: string) => nodeOf.get(id) ?? null;
  const edges = $derived(focusEdges(props.edges ?? [], selected) ?? props.edges ?? []);
  let sticky = $state(new Map<string, number>());
  let wasEditing = new Set<string>();
  $effect(() => {
    const now = editIds;
    const left = [...wasEditing].filter((id) => !now.has(id));
    wasEditing = new Set(now);
    if (left.length) {
      untrack(() => (sticky = new Map([...sticky, ...left.map((id) => [id, Date.now()] as const)])));
    }
  });
  $effect(() => {
    const seen = visibleIds(placed.filter((t) => sticky.has(t.id)), view, area);
    const keep = new Map([...sticky].filter(([id]) => seen.has(id)));
    if (keep.size !== untrack(() => sticky.size)) {
      sticky = keep;
    }
  });
  const LIVE_CODE_CAP = 4;
  const IFRAME_TYPE = 'iframe';
  const liveCode = $derived([...visibleIds(placed.filter((t) => t.kind === IFRAME_TYPE && isLiveCode(summaries.get(t.id)?.data)), view, area)].slice(0, LIVE_CODE_CAP));
  const domIds = $derived.by(() => {
    const next = new Set([...editIds, ...sticky.keys(), ...liveCode, ...(focusLive ? [focusLive] : [])]);
    return sameSet(lastDom, next) ? lastDom : (lastDom = next);
  });
  let lastDom = new Set<string>();
  let core = $state.raw<ReturnType<typeof CoreFrames> | null>(null);
  let ramRuns = $state<FrameRange[]>([]);
  let ramRun: AbortController | null = null;
  let ramNode = $state('');

  function cacheRam(nodeId: string, doc: MotionDoc) {
    ramRun?.abort();
    ramRun = new AbortController();
    ramRuns = [];
    ramNode = nodeId;
    const range = doc.workArea ?? { from: 0, to: doc.durationInFrames };
    void core?.cache(nodeId, range, ramRun.signal, (runs) => (ramRuns = runs));
  }
  let coreDrawn = $state(new Set<string>());
  const coreFrames = $derived(framesOnCanvas(placed, (id) => summaries.get(id)?.data ?? {}));
  const editIds = $derived(editableIds(selected, DOM_CAP, new Set([...coreFrames.map((f) => f.id), ...placed.filter((t) => t.kind === SECTION_TYPE).map((t) => t.id)])));
  const overlayFrames = $derived(coreFrames.map((f) => ({ id: f.id, ...f.box, rotation: byId.get(f.id)?.rotation ?? 0, bar: 0, doc: { width: f.box.w, height: f.box.h } })));
  const prototypeDocs = $derived(new Map(coreFrames.flatMap((f) => (liveOf(f.id) ? [[f.id, liveOf(f.id)!.doc] as const] : []))));
  const arrowLinks = $derived(prototypeLinks(prototypeDocs));
  const playerFrames = $derived(coreFrames.filter((f) => kindOfNode(f.id) === FrameKind.Frame && liveOf(f.id)).map((f) => ({ id: f.id, name: tileLabel(byId.get(f.id)!), live: liveOf(f.id)! })));
  $effect(() => {
    prototypePlayer.editing = inside?.nodeId ?? (selected.length === 1 && playerFrames.some((f) => f.id === selected[0]) ? selected[0] : null);
  });
  $effect(() => {
    prototypeLink.docs = prototypeDocs;
    prototypeLink.targets = coreFrames.filter((f) => kindOfNode(f.id) === FrameKind.Frame).map((f) => ({ id: f.id, name: tileLabel(byId.get(f.id)!) }));
  });
  let coreType = $state<CoreText | null>(null);
  $effect(() => {
    if (!coreType) {
      void coreText(NODE_TYPES).then((t) => (coreType = t)).catch((e: unknown) => console.warn('[canvas] core text not loaded', e));
    }
  });
  const coreLook = $derived(wrap ? themeOf(wrap) : null);
  const tagHexOf = (id: string) => {
    const tag = colourOf(summaries.get(id)?.data ?? {});
    return tag ? COLOUR_TAG_HEX[tag] : null;
  };
  const drawsCard = (t: Tile) => !!t.kind && isNodeType(t.kind) && !handedOver(t);
  const drawCard = $derived(coreType && coreLook ? cardsOnCanvas({ ...coreLook, panel: coreLook.paper }, coreType.glyphs, coreType.bold, coreType.gen) : null);
  const labelZoom = $derived(labelZoomStep(view.zoom));
  const strokeZoom = $derived(strokeZoomStep(view.zoom));
  const coreCards = $derived.by(() => {
    const text = coreType;
    const draw = drawCard;
    if (!text || !draw) {
      return [];
    }
    return placed.filter(drawsCard).flatMap((t) => {
      const card: CardTile = {
        id: t.id,
        box: { x: t.x, y: t.y, w: t.w, h: t.h },
        face: faceOf(t, summaries.get(t.id)?.data ?? {}, tierUrl, props.viewOf?.(t.id) ?? null, props.genViewFor?.(t.id) ?? null),
        ...portMarks(t),
        label: labelOf(t),
        icon: text.icons.get(t.kind as NodeType) ?? null,
        tag: tagHexOf(t.id),
        zoom: labelZoom
      };
      const poster = holdsDoc(t.kind ?? '');
      return [{ key: cardKey(card), frame: draw(card, poster ? CardLayer.Face : CardLayer.Whole), turn: turnOf(t), poster }];
    });
  });
  const addsBeside = (t: Tile) => holdsDoc(t.kind ?? '') && kindOfNode(t.id) === FrameKind.Frame;
  const turnOf = (t: Tile) => (t.rotation ? { degrees: t.rotation, about: { x: t.x + t.w / 2, y: t.y + t.h / 2 } } : undefined);
  const coreChrome = $derived.by(() => {
    const look = coreLook;
    const text = coreType;
    if (!look || !text) {
      return [];
    }
    const views = bpViews.flatMap((v) => {
      const t = byId.get(v.nodeId);
      if (!t) {
        return [];
      }
      const on = savers.get(v.nodeId)?.breakpoint === v.breakpointId && selected.includes(t.id);
      const chrome = nodeChrome(t.id, on, layersSource.video, typedFreeText());
      const { x, y, w, h } = v.frame.box;
      return [{ id: v.frame.id, x, y, width: w, height: h, ...portMarks({ ...t, connectable: false }), label: `${v.name} ${v.width}`, icon: text.icons.get(t.kind as NodeType) ?? null, tag: null, zoom: labelZoom, ring: on ? chrome.ring : NodeChrome.None, handles: false, hovered: false, ringColor: ringColour(), names: false, strokeZoom, addBeside: false, radius: cardRadiusOf(t.kind ?? ''), turn: undefined, layers: ChromeLayers.Whole }];
    });
    const tiles = placed.flatMap((t) => {
      const handed = handedOver(t) && !holdsDoc(t.kind ?? '');
      if (!coreDrawn.has(t.id) && !handed) {
        return [];
      }
      const on = selected.includes(t.id);
      const chrome = nodeChrome(t.id, on, layersSource.video, typedFreeText());
      const ringed = !on && frameRinged(layersSource.hovered, t.id, layersSource.video?.nodeId ?? null, hovered);
      const layers = holdsDoc(t.kind ?? '') ? ChromeLayers.Whole : handed ? ChromeLayers.Ports : ChromeLayers.State;
      if (layers === ChromeLayers.State && chrome.ring === NodeChrome.None && !ringed) {
        return [];
      }
      const marks = portMarks(t);
      const own = layers === ChromeLayers.Whole ? { label: labelOf(t), icon: text.icons.get(t.kind as NodeType) ?? null, tag: tagHexOf(t.id), zoom: labelZoom } : { label: null, icon: null };
      return [{ id: t.id, x: t.x, y: t.y, width: t.w, height: t.h, ...marks, ...own, ring: chrome.ring, handles: resizable && on && chrome.handles, hovered: ringed, ringColor: ringColour(), names: on, strokeZoom, addBeside: addsBeside(t) && (on || hovered === t.id || addLinger === t.id), radius: cardRadiusOf(t.kind ?? ''), turn: turnOf(t), layers }];
    });
    return [...tiles, ...views];
  });
  const posterCards = $derived(coreCards.filter((c) => c.poster));
  const nodeCards = $derived(coreCards.filter((c) => !c.poster));
  const coreSource = (id: string) => `/p/${page.params.projectId}/c/${page.params.canvasId}/motion/${baseNodeId(id)}/source`;
  let domShows = $state(new Set<string>());
  const handedOver = (t: Tile) => domIds.has(t.id) && (!holdsDoc(t.kind ?? '') || domShows.has(t.id));
  $effect(() => {
    const kept = [...untrack(() => domShows)].filter((id) => domIds.has(id));
    if (kept.length !== untrack(() => domShows.size)) {
      domShows = new Set(kept);
    }
  });
  $effect(() => {
    const el = wrap;
    if (!el) {
      return;
    }
    const painted = (e: Event) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('.gpu-dom-node')?.dataset.id;
      if (id && !domShows.has(id)) {
        domShows = new Set([...domShows, id]);
      }
    };
    el.addEventListener(TILE_PAINTED, painted);
    return () => el.removeEventListener(TILE_PAINTED, painted);
  });
  let hoverChrome = $state<string | null>(null);
  const chromeIds = $derived(new Set([...selected, ...domIds, ...(hoverChrome ? [hoverChrome] : []), ...(ghost ? [ghost.from.nodeId] : [])]));
  const labelOf = (t: Tile) => {
    const kind = t.kind && isNodeType(t.kind) ? t.kind : null;
    return t.tag === NameTag.Hidden ? null : t.displayName?.trim() || (kind ? NODE_KIND_LABEL[kind] : null);
  };
  const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
  function drawnByCore(ids: Set<string>) {
    if (!sameSet(untrack(() => coreDrawn), ids)) {
      coreDrawn = ids;
    }
  }

  const BUSY_MS = 400;
  const IDLE_SLICE_MS = 12;
  const QUIET_MAX_WAIT_MS = 5000;
  let busyUntil = 0;
  const markBusy = () => {
    busyUntil = performance.now() + BUSY_MS;
  };
  const quiet = (since = performance.now()) =>
    new Promise<void>((resolve) => {
      const check = (deadline?: IdleDeadline) => {
        const calm = performance.now() > busyUntil && (!deadline || deadline.timeRemaining() >= IDLE_SLICE_MS);
        if (calm || performance.now() - since > QUIET_MAX_WAIT_MS) {
          resolve();
          return;
        }
        if ('requestIdleCallback' in window) {
          requestIdleCallback(check, { timeout: BUSY_MS });
          return;
        }
        setTimeout(check, BUSY_MS);
      };
      check();
    });
  let focusLive = $state<string | null>(null);
  let openedAt = 0;
  const mountedAt = performance.now();
  let loadTimer: ReturnType<typeof loadTiming> | null = null;
  function canvasLoadTiming(renderer: string) {
    const openedOn = new URL((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.name ?? location.href).pathname;
    const kind = claimLoad(openedOn, location.pathname);
    const origin = kind === LoadKind.Navigation ? 0 : mountedAt;
    return loadTiming({ kind, renderer, nodes: tiles.length, device: currentDevice(), engine: engineOf(navigator.userAgent), now: () => performance.now() - origin, raf: (frame) => requestAnimationFrame(frame), report: (r) => track(CANVAS_LOAD_EVENT, r) });
  }
  let revealed = $state(false);
  let revealTick = $state(0);
  const REVEAL_POLL_MS = 100;
  const domDrawn = (id: string) => !!wrap?.querySelector(`.gpu-dom-node[data-id="${id}"] [data-drawn="true"], .gpu-dom-node[data-id="${id}"] img.poster`);
  const previewed = (t: Tile) => {
    if (domIds.has(t.id)) {
      return !holdsDoc(t.kind ?? '') || domDrawn(t.id);
    }
    return coreDrawn.has(t.id);
  };
  const cullIndex = $derived(new SpatialIndex(placed));
  const unpreviewed = () => [...cullIndex.visible(view, area)].filter((id) => byId.get(id) && !previewed(byId.get(id)!));

  $effect(() => {
    void revealTick;
    if (revealed) {
      return;
    }
    if (!area.width || (tiles.length && !fitted)) {
      const t = setTimeout(() => revealTick++, REVEAL_POLL_MS);
      return () => clearTimeout(t);
    }
    openedAt ||= performance.now();
    const missing = unpreviewed();
    const wait = revealDelay(missing.length, performance.now() - openedAt);
    if (!wait) {
      revealed = true;
      exposeReveal(Math.round(performance.now() - openedAt), missing);
      loadTimer = spec.chrome ? canvasLoadTiming(CORE) : null;
      loadTimer?.revealed(missing.length, performance.now() - openedAt);
      return;
    }
    const t = setTimeout(() => revealTick++, Math.min(wait, REVEAL_POLL_MS));
    return () => clearTimeout(t);
  });

  let settled = false;
  $effect(() => {
    void revealTick;
    if (!revealed || settled) {
      return;
    }
    const missing = unpreviewed();
    if (!missing.length) {
      settled = true;
      exposeSettled(Math.round(performance.now() - openedAt));
      loadTimer?.settled();
      return;
    }
    const t = setTimeout(() => revealTick++, REVEAL_POLL_MS);
    return () => clearTimeout(t);
  });

  function trackFocus(e: FocusEvent) {
    focusLive = (e.target as HTMLElement | null)?.closest<HTMLElement>('.gpu-dom-node')?.dataset.id ?? null;
  }

  function portFor(nodeId: string, side: PortSide, handle: string | null | undefined): Port | null {
    const own = ports.filter((p) => p.nodeId === nodeId && p.side === side);
    return own.find((p) => p.handle === (handle ?? null)) ?? own[0] ?? null;
  }

  const showsPrototype = $derived(editorMode.spec.lines === CanvasLines.Prototype);

  let modeShown = editorMode.current;
  $effect(() => {
    const mode = editorMode.current;
    if (mode === modeShown) {
      return;
    }
    modeShown = mode;
    untrack(() => {
      rightBar.select(BarTab.Properties);
      if (mode === EditorMode.Motion && selected.length === 0 && coreFrames[0]) {
        select([coreFrames[0].id]);
      }
    });
  });
  const curves = $derived(
    (showsPrototype ? [] : edges).flatMap((e) => {
      const from = portFor(e.source, PortSide.Out, e.sourceHandle);
      const to = portFor(e.target, PortSide.In, e.targetHandle);
      return from && to ? [{ edge: e, curve: wireCurve({ x: from.x + PORT_OFFSET, y: from.y }, { x: to.x - PORT_OFFSET, y: to.y }) }] : [];
    })
  );

  const selectedBoxes = $derived(selected.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])));
  const rotatable = $derived(props.onRotate && selectedBoxes.length === 1 && selectedBoxes[0].rotatable && !selectedBoxes[0].locked && editable ? selectedBoxes[0] : null);
  const resizable = $derived(selectedBoxes.length === 1 && selectedBoxes[0].minW != null && selectedBoxes[0].minH != null && !selectedBoxes[0].locked && editable);
  const transformable = (t: (typeof placed)[number]) => t.minW != null && t.minH != null && !t.locked;
  const placedOf = (t: (typeof placed)[number]): Placed => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation ?? 0 });
  const many = $derived(editable && selectedBoxes.length > 1 && selectedBoxes.every(transformable) ? selectedBoxes.map(placedOf) : []);
  const manyBox = $derived(many.length ? selectionBox(many) : null);
  const manyQuad = $derived.by(() => {
    const box = spin?.box ?? manyBox;
    if (!box) {
      return null;
    }
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const r = ((spin?.degrees ?? 0) * Math.PI) / 180;
    return [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x + box.w, box.y + box.h],
      [box.x, box.y + box.h]
    ].map(([x, y]) => {
      const dx = x - centre.x;
      const dy = y - centre.y;
      return [view.x + (centre.x + dx * Math.cos(r) - dy * Math.sin(r)) * view.zoom, view.y + (centre.y + dx * Math.sin(r) + dy * Math.cos(r)) * view.zoom] as const;
    });
  });

  const heldCanvas = $derived(props.canvasId ?? page.params.canvasId ?? '');

  $effect(() => {
    const incoming = tiles;
    const canvasId = heldCanvas;
    untrack(() => adoptNew(incoming, canvasId));
  });

  function adoptNew(incoming: Tile[], canvasId: string) {
    const added = incoming.filter((t) => !known.has(t.id));
    known = new Set(incoming.map((t) => t.id));
    const chosen = added.filter((t) => t.select).map((t) => t.id);
    if (chosen.length) {
      select(chosen);
    }
    const gone = selected.filter((id) => !known.has(id));
    if (gone.length) {
      select(selected.filter((id) => known.has(id)));
    }
    if (fitted && fittedCanvas === canvasId) {
      return;
    }
    fitted = true;
    fittedCanvas = canvasId;
    cancelAnimationFrame(tween);
    const saved = props.viewerId ? loadViewport(props.viewerId, canvasId) : null;
    const s = screenSize();
    view = restoreViewport(saved, boundsOf(incoming), { width: s.width, height: s.height });
  }

  const REMEMBER_VIEW_MS = 400;
  $effect(() => {
    const at = view;
    const who = props.viewerId;
    const canvasId = fittedCanvas;
    if (!who || !fitted) {
      return;
    }
    const timer = setTimeout(() => rememberViewport(who, canvasId, at), REMEMBER_VIEW_MS);
    return () => clearTimeout(timer);
  });

  let reported = '';
  function select(ids: string[]) {
    selected = ids;
    const key = ids.join(',');
    if (key === reported) {
      return;
    }
    reported = key;
    props.onSelectionChange?.(ids);
  }

  let surfaceRect: { width: number; height: number; left: number; top: number } | null = null;

  function measureSurface() {
    const r = surface?.getBoundingClientRect();
    surfaceRect = r ? { width: r.width, height: r.height, left: r.left, top: r.top } : null;
  }

  function screenSize() {
    if (!surfaceRect?.width) {
      measureSurface();
    }
    return surfaceRect ?? { width: innerWidth, height: innerHeight, left: 0, top: 0 };
  }

  function boundsOf(boxes: WorldRect[]): { x: number; y: number; width: number; height: number } | null {
    if (!boxes.length) {
      return null;
    }
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, width: Math.max(...boxes.map((b) => b.x + b.w)) - x, height: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  }

  function fitTo(boxes: WorldRect[], purpose: FitPurpose) {
    const b = boundsOf(boxes);
    if (!b) {
      return;
    }
    const s = screenSize();
    const target = fitView(b, { width: s.width, height: s.height }, purpose);
    if (target) {
      animateTo(target);
    }
  }

  function pickedRects(): WorldRect[] {
    const at = inside?.level.clip && picks.length ? pickerOf(inside.nodeId) : null;
    return at ? picks.flatMap((id) => at.picker.outline(id, at.space) ?? []) : [];
  }

  function zoomToSelection() {
    const rects = pickedRects();
    if (rects.length) {
      fitTo(rects, FitPurpose.Command);
      return;
    }
    if (selectedBoxes.length) {
      fitTo(selectedBoxes, FitPurpose.Command);
    }
  }

  function centreSelection() {
    const rects = pickedRects();
    const b = boundsOf(rects.length ? rects : selectedBoxes);
    if (!b) {
      return;
    }
    const s = screenSize();
    animateTo(centreIn(b, view, { width: s.width, height: s.height }));
  }

  let tween = 0;

  function takeCamera() {
    glide = null;
    cancelAnimationFrame(tween);
  }

  function animateTo(target: Viewport) {
    cancelAnimationFrame(tween);
    const from = view;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / FIT_MS);
      const e = 1 - Math.pow(1 - k, 3);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, zoom: from.zoom + (target.zoom - from.zoom) * e };
      if (k < 1) {
        tween = requestAnimationFrame(step);
      }
    };
    tween = requestAnimationFrame(step);
  }

  const toFlow = (p: Point): Point => {
    const s = screenSize();
    return toWorld(view, { x: p.x - s.left, y: p.y - s.top });
  };

  const selection = $derived.by(() => {
    const b = boundsOf(selectedBoxes);
    if (!b) {
      return { ids: selected, box: null, zoom: view.zoom };
    }
    const s = screenSize();
    const left = s.left + view.x + b.x * view.zoom;
    const top = s.top + view.y + (b.y - LABEL_CLEARANCE) * view.zoom;
    return { ids: selected, box: { x: left, y: top, width: b.width * view.zoom, height: (b.height + LABEL_CLEARANCE) * view.zoom }, zoom: view.zoom };
  });

  $effect(() => {
    const f = props.focus;
    const ids = f?.ids;
    if (!ids?.length) {
      return;
    }
    const mode = f?.mode ?? FocusMode.Frame;
    if (focusSelects(mode)) {
      untrack(() => select([...ids]));
    }
    if (f?.mode !== FocusMode.Frame) {
      const b = untrack(() => boundsOf(ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))));
      const s = untrack(() => screenSize());
      const screen = { width: s.width, height: s.height };
      const placement = focusPlacement(mode);
      if (b && placement === Placement.Centre) {
        untrack(() => animateTo(centreIn(b, view, screen)));
        return;
      }
      if (b && untrack(() => inView(b, view, screen, f?.free))) {
        return;
      }
      if (b && placement === Placement.Slide) {
        untrack(() => animateTo(revealIn(b, view, screen, f?.free)));
        return;
      }
    }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => untrack(() => focusOn(ids, f?.free ?? null, focusPlacement(mode)))));
    return () => cancelAnimationFrame(frame);
  });

  function focusOn(ids: readonly string[], free: Insets | null, placement: Placement) {
    const boxes = ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
    const b = boundsOf(boxes);
    if (!b) {
      return;
    }
    if (placement === Placement.Slide) {
      const s = screenSize();
      animateTo(revealIn(b, view, { width: s.width, height: s.height }, free ?? undefined));
      return;
    }
    if (free) {
      const s = screenSize();
      animateTo(frameIn(b, { width: s.width, height: s.height }, free, EDIT_MAX_ZOOM));
      return;
    }
    fitTo(boxes, FitPurpose.Open);
  }

  type Active =
    | { kind: GestureKind.Pan; last: Point; moved: boolean }
    | { kind: GestureKind.Drag; id: string; start: Point; origins: Map<string, Point>; moved: boolean; toggle: boolean }
    | { kind: GestureKind.Resize; id: string; unit: [number, number]; rotation: number; start: Point; box: Box; min: { w: number; h: number }; main?: string; dragged?: Box }
    | { kind: GestureKind.Rotate; id: string; centre: Point; start: Point; base: number; degrees: number }
    | { kind: GestureKind.ResizeMany; unit: [number, number]; start: Point; box: Box; items: Placed[] }
    | { kind: GestureKind.TurnMany; centre: Point; start: Point; box: Box; items: Placed[] }
    | { kind: GestureKind.Marquee; start: Point; base: string[]; additive: boolean; moved: boolean }
    | { kind: GestureKind.Connect; from: Port }
    | { kind: GestureKind.PickEdge; edgeId: string };

  let active: Active | null = null;
  let downAt: Point = { x: 0, y: 0 };
  const touches = new Map<number, Point>();
  let pinch: { dist: number; mid: Point } | null = null;
  let suppressMenu = false;
  let captureId: number | null = null;

  function local(e: { clientX: number; clientY: number }): Point {
    const s = screenSize();
    return { x: e.clientX - s.left, y: e.clientY - s.top };
  }

  const NO_GLYPHS: Glyphs = () => ({ contours: [], width: 0, height: 0 });
  const hitRects = $derived(
    placed.map((t) => {
      const glyphs = coreType?.glyphs;
      const tile: ChromeTile = { id: t.id, x: t.x, y: t.y, width: t.w, height: t.h, inputs: [], outputs: [], label: glyphs ? labelOf(t) : null, icon: coreType?.icons.get(t.kind as NodeType) ?? null, tag: glyphs ? tagHexOf(t.id) : null, zoom: labelZoom };
      const [body, ...labels] = nodeHitRects(tile, glyphs ?? NO_GLYPHS);
      return { body, labels };
    })
  );
  const hitIndex = $derived(new SpatialIndex(hitRects.flatMap((r) => [r.body, ...r.labels])));
  const labelIndex = $derived(new SpatialIndex(hitRects.flatMap((r) => r.labels)));

  const topNodeAt = (w: Point): string | null => hitIndex.topAt(w);

  function hitAt(w: Point): Hit {
    const unit = resizable ? resizeHandleAt(selectedBoxes[0], w, view.zoom) : null;
    if (unit) {
      return { kind: HitKind.Corner, nodeId: selectedBoxes[0].id, unit };
    }
    const port = connectable ? portAt(ports, w, view.zoom) : null;
    if (port) {
      return { kind: HitKind.Port, nodeId: port.nodeId, handle: port.handle };
    }
    const turnUnit = rotatable ? rotateZoneAt(rotatable, rotatable.rotation ?? 0, w, view.zoom) : null;
    if (rotatable && turnUnit) {
      return { kind: HitKind.Rotate, nodeId: rotatable.id, unit: turnUnit };
    }
    const node = topNodeAt(w);
    if (node) {
      return { kind: HitKind.Node, nodeId: node };
    }
    const edge = edgeAt(curves.map((c) => ({ id: c.edge.id, curve: c.curve })), w, view.zoom);
    return edge ? { kind: HitKind.Edge, edgeId: edge } : { kind: HitKind.Empty };
  }

  function boxHit(hit: Hit, target: HTMLElement): Hit {
    const box = target.closest<HTMLElement>('.gpu-node')?.dataset.id;
    const overridable = hit.kind === HitKind.Node || hit.kind === HitKind.Empty || hit.kind === HitKind.Edge;
    return overridable && box ? { kind: HitKind.Node, nodeId: box } : hit;
  }

  function onClickInside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const id = target.closest<HTMLElement>('.gpu-dom-node')?.dataset.id;
    if (!id || !ownsPress(target, e.clientY) || !spec.flow.elementsSelectable || selected.includes(id)) {
      return;
    }
    clickNode(id, e.shiftKey || e.metaKey || e.ctrlKey);
  }

  let naming = $state<{ nodeId: string; value: string; was: string } | null>(null);

  const NAME_MIN_WIDTH = 120;
  const NAME_HEIGHT = 22;

  const namingBox = $derived.by(() => {
    const tile = naming ? byId.get(naming.nodeId) : null;
    if (!tile) {
      return null;
    }
    const s = screenSize();
    return { left: s.left + view.x + tile.x * view.zoom, top: s.top + view.y + (tile.y - LABEL_CLEARANCE) * view.zoom, width: Math.max(tile.w * view.zoom, NAME_MIN_WIDTH) };
  });

  function titledAt(world: Point): Tile | null {
    const id = labelIndex.topAt(world);
    return id ? (byId.get(id) ?? null) : null;
  }

  function startNaming(tile: Tile) {
    const was = tile.displayName?.trim() ?? '';
    select([tile.id]);
    naming = { nodeId: tile.id, value: was, was };
  }

  function endNaming(save: boolean) {
    const open = naming;
    naming = null;
    if (open && save && open.value.trim() !== open.was) {
      props.onRename?.(open.nodeId, open.value);
    }
  }

  function onNamingKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      endNaming(true);
    }
    if (e.key === 'Escape') {
      endNaming(false);
    }
  }

  function onDouble(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.gpu-dom-node [data-motion-node]')) {
      return;
    }
    const world = toWorld(view, local(e as PointerEvent));
    const titled = spec.chrome && props.onRename ? titledAt(world) : null;
    if (titled) {
      startNaming(titled);
      return;
    }
    const hit = hitAt(world);
    const deeper = framePickAt(world, picks);
    const id = hit.kind === HitKind.Node ? hit.nodeId : (deeper?.nodeId ?? null);
    const doc = id ? liveOf(id)?.doc : null;
    const held = id && deeper && inside?.nodeId === id ? picks : [];
    const chain = deeper && held.length ? deeper.picker.chain(world, deeper.space) : [];
    const entered = doc && held.length ? (enteredFrom(chain, held) ?? (deeper?.clip ? childBelow(doc, deeper.clip, held) : null)) : null;
    if (id && entered) {
      pickMany(id, [entered]);
      return;
    }
    if (id && deeper?.clip) {
      const target = doubledOn(chain, held, deeper.clip);
      select([id]);
      goInside(id, Gesture.Double, target);
      if (editable) {
        void startTyping(id, target);
        startCrop(id, target);
      }
      return;
    }
    if (id && !target.closest('textarea, input, [contenteditable="true"]')) {
      props.onNodeDoubled?.(id);
    }
    const stage = id ? wrap?.querySelector<HTMLElement>(`[data-motion-node="${id}"] [data-frame-stage]`)?.getBoundingClientRect() : null;
    if (!id || !stage || stage.width <= 0 || stage.height <= 0) {
      return;
    }
    frameDrill.request(id, { x: (e.clientX - stage.left) / stage.width, y: (e.clientY - stage.top) / stage.height }, Gesture.Double);
  }

  const pointerOf = (e: PointerEvent) => (e.pointerType === 'touch' ? Pointer.Touch : e.pointerType === 'pen' ? Pointer.Pen : Pointer.Mouse);

  const fling = new Fling();
  let glide: Glide | null = null;
  let glidedAt = 0;

  function glideStep(t: number): boolean {
    const d = glide?.step(glidedAt ? t - glidedAt : 0);
    glidedAt = t;
    if (!d) {
      glide = null;
      return false;
    }
    view = panBy(view, d);
    return true;
  }

  const glider = new FramePacer(glideStep, (frame) => requestAnimationFrame(frame));

  function startGlide() {
    glide = fling.release(performance.now());
    glidedAt = 0;
    glider.invalidate();
  }

  const pickers = new FramePickers();
  let fetched = $state.raw(new Map<string, { revision: number; live: LiveDoc }>());
  const asked = new Set<string>();

  const PICK_DOC_RETRIES = 4;
  const PICK_DOC_RETRY_MS = 1000;

  const pickKey = (f: { id: string; revision: number; linked?: string }) => `${f.id}:${f.revision}:${f.linked ?? ''}`;

  async function fetchPickDoc(id: string, revision: number, attempt = 0) {
    const res = await fetch(`${coreSource(id)}?revision=${revision}`, { cache: 'no-store' }).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { doc: LiveDoc['doc']; tokens: LiveDoc['tokens']; assets: LiveDoc['assets'] } | null) : null;
    if (body?.doc) {
      fetched = new Map(fetched).set(id, { revision, live: { doc: body.doc, tokens: body.tokens, assets: body.assets ?? {} } });
      return;
    }
    if (attempt < PICK_DOC_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, PICK_DOC_RETRY_MS));
      await fetchPickDoc(id, revision, attempt + 1);
    }
  }

  const stepped = new Set<string>();
  const stepKey = (id: string, revision: number) => `${id}:${revision}`;
  const knownSource = (f: FrameAt) => {
    const held = fetched.get(f.id);
    return held && held.revision === f.revision && stepped.has(stepKey(f.id, f.revision)) ? { revision: f.revision, ...held.live } : null;
  };

  function takeStep(step: PeerStep) {
    const saver = savers.get(step.nodeId);
    if (saver?.followStep(step)) {
      return;
    }
    const held = fetched.get(step.nodeId);
    const linked = coreFrames.find((f) => f.id === step.nodeId)?.linked;
    const doc = held && !linked ? nextDoc({ version: held.revision, doc: held.live.doc, assets: held.live.assets }, step) : null;
    if (!held || !doc) {
      return;
    }
    stepped.add(stepKey(step.nodeId, step.version));
    fetched = new Map(fetched).set(step.nodeId, { revision: step.version, live: { ...held.live, doc } });
  }

  const STEP_WAIT_MS = 400;

  async function followHead(nodeId: string, saver: FrameEditSession) {
    await new Promise((resolve) => setTimeout(resolve, STEP_WAIT_MS));
    const revision = revisionOfFrame(nodeId);
    if (revision <= saver.version) {
      return;
    }
    const res = await fetch(coreSource(nodeId), { cache: 'no-store' }).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { revision: number; doc: LiveDoc['doc'] } | null) : null;
    if (body?.doc && body.revision > saver.version) {
      saver.takeRemote({ version: body.revision, doc: body.doc });
    }
  }

  const following = new Set<string>();

  $effect(() => {
    for (const f of coreFrames) {
      const saver = savers.get(f.id);
      if (saver && liveDocs.map.has(f.id) && f.revision > untrack(() => saver.version) && !following.has(stepKey(f.id, f.revision))) {
        following.add(stepKey(f.id, f.revision));
        void followHead(f.id, saver);
      }
    }
  });

  $effect(() => {
    const due = toFetch(coreFrames.filter((f) => fetched.get(f.id)?.revision !== f.revision), pickKey, asked, liveDocs.map);
    if (!due.length) {
      return;
    }
    due.forEach((f) => asked.add(pickKey(f)));
    void (async () => {
      for (const f of due) {
        await quiet();
        if (fetched.get(f.id)?.revision !== f.revision) {
          await fetchPickDoc(f.id, f.revision);
        }
      }
    })();
  });

  function viewPickAt(w: Point, picked: readonly string[]) {
    const hit = viewAt(bpViews, w);
    const live = hit ? viewLives.get(hit.frame.id) : null;
    if (!hit || !live) {
      return null;
    }
    const picker = pickers.of(hit.frame.id, live, () => liveOf(hit.nodeId)?.playhead);
    const space = picker.spaceOf(hit.frame.box, 0);
    const clip = picker.pickHeld(w, space, inside?.nodeId === hit.nodeId ? picked : []);
    return { nodeId: hit.nodeId, breakpointId: hit.breakpointId, clip, space, picker, frame: hit.frame };
  }

  function framePickAt(w: Point, picked: readonly string[] = []) {
    const inView = viewPickAt(w, picked);
    if (inView) {
      return inView;
    }
    const id = topNodeAt(w);
    const frame = id && !domIds.has(id) ? coreFrames.find((f) => f.id === id) : null;
    const live = frame ? (liveDocs.map.get(frame.id) ?? fetched.get(frame.id)?.live) : null;
    if (!frame || !live) {
      return null;
    }
    const picker = pickers.of(frame.id, live, () => liveOf(frame.id)?.playhead);
    const space = picker.spaceOf(frame.box, byId.get(frame.id)?.rotation ?? 0);
    const clip = picker.pickHeld(w, space, inside?.nodeId === frame.id ? picked : []);
    return { nodeId: frame.id, breakpointId: BASE_BREAKPOINT, clip, space, picker, frame };
  }

  function hoverElement(w: Point, reach: Reach) {
    const hit = elementAt(w, reach, clickPick);
    const quad = hit ? hit.picker.outlineQuad(hit.clip, hit.space) : null;
    pickHover = hit && quad ? { nodeId: hit.nodeId, clip: hit.clip, quad, at: hit.frame.id, highlight: highlightOf(liveOf(hit.nodeId)!.doc, hit.clip) } : null;
    layersSource.hover(pickHover ? { nodeId: pickHover.nodeId, id: pickHover.clip } : null);
  }

  let handleCursor = $state<string | null>(null);

  function hoverHandle(w: Point) {
    const hit = hitAt(w);
    const box = hit.kind === HitKind.Corner || hit.kind === HitKind.Rotate ? byId.get(hit.nodeId) : null;
    if (!box || (hit.kind !== HitKind.Corner && hit.kind !== HitKind.Rotate)) {
      handleCursor = null;
      return;
    }
    const outward: [number, number] = [hit.unit[0] * 2 - 1, hit.unit[1] * 2 - 1];
    handleCursor = hit.kind === HitKind.Corner ? resizeCursor(outward, box.rotation ?? 0) : rotateCursor(outward, box.rotation ?? 0);
  }

  function dropHover() {
    pickHover = null;
    layersSource.hover(null);
  }

  let inside = $state<Inside | null>(null);
  const savers = new Map<string, FrameEditSession>();
  const settle = new PickerSettle();
  const reuseOf = (nodeId: string) => (savers.get(nodeId)?.live.active() || settle.settling(nodeId) ? Reuse.Held : Reuse.Changed);

  $effect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      const open = [...savers.values()].filter((s) => s.unsaved());
      if (!open.length) {
        return;
      }
      open.forEach((s) => void s.flushPending());
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  });
  const insideLevel = (nodeId: string) => (inside?.nodeId === nodeId ? inside.level : frameLevel());
  const liveOf = (id: string) => liveDocs.map.get(id) ?? fetched.get(id)?.live ?? null;
  const revisionOfFrame = (id: string) => coreFrames.find((f) => f.id === id)?.revision ?? 0;
  const viewDocs = new Map<string, LiveDoc['doc']>();
  const viewDocOf = (id: string) => {
    const held = viewDocs.get(id);
    if (held && reuseOf(id) === Reuse.Held) {
      return held;
    }
    const doc = liveOf(id)?.doc;
    if (doc) {
      viewDocs.set(id, doc);
    }
    return doc;
  };
  const resolveViews = heldViews();
  const bpViews = $derived(resolveViews(coreFrames, viewDocOf));
  const heldInResize = $derived(new Set([...resizing].filter((id) => frameChrome(kindOfNode(id)).resize === ResizePaint.Held)));
  const drawnFrames = $derived(coreFrames.map((f) => {
    const doc = liveOf(f.id)?.doc;
    const scenes = doc ? sceneStamp(doc, (id) => sceneRevision(revisionOfFrame(id), liveDocs.edits.get(id))) : '';
    return scenes ? { ...f, scenes } : f;
  }).concat(bpViews.map((v) => v.frame)));
  const viewsShown = new Map<string, LiveDoc>();
  const viewLives = $derived(new Map(bpViews.flatMap((v) => {
    const live = liveOf(v.nodeId);
    if (!live) {
      return [];
    }
    const held = viewsShown.get(v.frame.id);
    const next = { ...live, doc: v.doc };
    const shown = held && sameLive(held, next) ? held : next;
    viewsShown.set(v.frame.id, shown);
    return [[v.frame.id, shown] as const];
  })));
  const viewOverlays = $derived(bpViews.map((v) => ({ id: v.frame.id, ...v.frame.box, rotation: 0, bar: 0, doc: { width: v.frame.box.w, height: v.frame.box.h } })));
  const coreLive = $derived(viewLives.size ? new Map([...liveDocs.map, ...viewLives]) : liveDocs.map);
  $effect(() => {
    canvasComponents.set(
      coreFrames.flatMap((f) => {
        const live = liveOf(f.id);
        return live ? [{ id: f.id, doc: live.doc }] : [];
      })
    );
  });
  onDestroy(() => canvasComponents.set([]));

  const PRIMARY_BUTTON = 0;
  const ROTATE_SNAP_DEG = 15;
  let picks = $state<string[]>([]);
  let bandDrag = $state<{ nodeId: string; from: Point; to: Point } | null>(null);

  function goInside(nodeId: string, gesture: Gesture, clip: string | null) {
    pickedPart = null;
    inside = { nodeId, level: stepInside(insideLevel(nodeId), gesture, clip) };
    picks = inside.level.clip ? [inside.level.clip] : [];
  }

  function pickMany(nodeId: string, ids: string[]) {
    pickedPart = null;
    inside = { nodeId, level: stepInside(frameLevel(), Gesture.Click, primaryOf(ids)) };
    picks = ids;
  }

  function extendPick(e: PointerEvent, w: Point): boolean {
    const keys = { shift: e.shiftKey, mod: e.metaKey || e.ctrlKey };
    const hit = e.button === 0 && e.pointerType === 'mouse' && mode !== CanvasMode.View && !space ? framePickAt(w) : null;
    const doc = hit ? liveOf(hit.nodeId)?.doc : null;
    if (!hit || !doc || frameChrome(kindOfNode(hit.nodeId)).dragsHost) {
      return false;
    }
    const entered = inside?.nodeId === hit.nodeId;
    const { box } = hit.frame;
    const onBody = w.x >= box.x && w.y >= box.y && w.x <= box.x + box.w && w.y <= box.y + box.h;
    const page = framePage(doc, frameChrome(kindOfNode(hit.nodeId)).root);
    const clips = doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.id !== page && (c.parent ?? null) === page).map((c) => c.id));
    const bandable = kindOfNode(hit.nodeId) === FrameKind.Frame && clips.length > 0;
    const plan = extendOf(keys, { onClip: !!hit.clip, onBody, held: selected.includes(hit.nodeId), entered, selectedElsewhere: selected.some((id) => id !== hit.nodeId), picks: entered ? picks.length : 0, bandable });
    if (plan.extend === Extend.None) {
      return false;
    }
    if (!entered) {
      select([hit.nodeId]);
      pickMany(hit.nodeId, []);
    }
    if (plan.extend === Extend.Toggle) {
      const clip = elementAt(w, plan.reach)?.clip ?? hit.clip;
      if (clip) {
        pickMany(hit.nodeId, toggleId(picks, clip));
      }
      return true;
    }
    const deep = plan.reach === Reach.Deep;
    const from = w;
    const move = (ev: PointerEvent) => {
      bandDrag = { nodeId: hit.nodeId, from, to: toWorld(view, local(ev)) };
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      bandDrag = null;
      const a = hit.picker.framePoint(from, hit.space);
      const b = hit.picker.framePoint(toWorld(view, local(ev)), hit.space);
      const rects = deep
        ? hit.picker.leafRects()
        : Object.fromEntries(clips.flatMap((id) => {
            const r = hit.picker.frameRect(id);
            return r ? [[id, r]] : [];
          }));
      pickMany(hit.nodeId, marqueeIds(rects, spanOf(a, b)));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return true;
  }

  function elementAt(w: Point, reach: Reach, choose: typeof pickTarget = pickTarget) {
    const hit = framePickAt(w);
    const doc = hit?.clip && !frameChrome(kindOfNode(hit.nodeId)).dragsHost ? liveOf(hit.nodeId)?.doc : null;
    if (!hit?.clip || !doc) {
      return null;
    }
    const clip = choose(doc, hit.picker.chain(w, hit.space), inside?.nodeId === hit.nodeId ? picks : [], reach);
    return clip ? { ...hit, clip } : null;
  }

  function groupOfPick(nodeId: string): string | null {
    const live = liveOf(nodeId);
    return live ? parentPick(live.doc, picks[0], frameChrome(kindOfNode(nodeId)).root) : null;
  }

  function pickElement(e: PointerEvent, w: Point): boolean {
    const reach = reachOf(e);
    const hit = e.button === 0 && !e.shiftKey && e.pointerType === 'mouse' ? elementAt(w, reach) : null;
    if (!hit) {
      return false;
    }
    select([hit.nodeId]);
    goInside(hit.nodeId, reach === Reach.Deep ? Gesture.Deep : Gesture.Click, hit.clip);
    const saver = saverOf(hit.nodeId);
    if (saver) {
      saver.breakpoint = hit.breakpointId;
    }
    return true;
  }

  const elementName = (nodeId: string): string | undefined => (frameChrome(kindOfNode(nodeId)).root === Root.Own ? (byId.get(nodeId)?.displayName ?? undefined) : undefined);

  const WHOLE_ELEMENT_RUN: Record<ElementAction, (nodeId: string) => void> = {
    [ElementAction.WrapStack]: (nodeId) => props.onWrapStack?.([nodeId]),
    [ElementAction.Duplicate]: (nodeId) => duplicateTiles([nodeId])
  };

  async function runFrameAction(id: ActionId) {
    const nodeId = inside?.nodeId;
    const live = nodeId ? liveOf(nodeId) : null;
    if (!nodeId || !live || !picks.length) {
      return;
    }
    const whole = frameChrome(kindOfNode(nodeId)).root === Root.Own ? wholeElementAction(id, live.doc, picks) : null;
    if (whole) {
      WHOLE_ELEMENT_RUN[whole](nodeId);
      return;
    }
    const at = scoped(live.doc, picks, frameOfLive(live));
    if (!at) {
      return;
    }
    const picked = picksFor(id, at.view, at.ids);
    if (picked) {
      pickMany(nodeId, at.scene(picked));
      return;
    }
    const done = await barActionLater(id, { doc: at.view, selection: at.ids, frame: at.frame, newId: () => crypto.randomUUID().slice(0, 8), load: letteringOf(live.tokens, live.assets), layer: elementName(nodeId) });
    if (!done) {
      return;
    }
    commit(nodeId, { ok: true, doc: at.merge(done.doc) }, done.summary);
    pickMany(nodeId, at.scene(done.selection));
    if (id === Action.CreateComponent && !onComponentsPage) {
      await saverOf(nodeId)?.flushScheduled();
      props.onComponentMade?.(nodeId);
    }
  }

  let elementMenu = $state<Point | null>(null);
  let elementLayers = $state<{ id: string; label: string }[]>([]);

  function openElementMenu(e: { clientX: number; clientY: number }): boolean {
    const hit = elementAt(toWorld(view, local(e)), Reach.Top);
    if (!hit) {
      return false;
    }
    if (inside?.nodeId !== hit.nodeId || !picks.includes(hit.clip)) {
      select([hit.nodeId]);
      goInside(hit.nodeId, Gesture.Click, hit.clip);
    }
    const world = toWorld(view, local(e));
    const under = framePickAt(world);
    const doc = liveOf(hit.nodeId)?.doc;
    elementLayers = under && doc ? frameLayers(doc, under.picker.stack(world, under.space)) : [];
    elementMenu = { x: e.clientX, y: e.clientY };
    return true;
  }

  function runElementMenu(id: SelectionActionId) {
    const run = frameMenuRun(id);
    if (run && 'edge' in run) {
      alignPicks(run.edge);
      return;
    }
    const action = frameMenuAction(id);
    if (action) {
      void runFrameAction(action);
    }
  }

  let ownPicked: string | null = null;

  function ownOf(nodeId: string): string | null {
    const doc = liveOf(nodeId)?.doc;
    return doc && frameChrome(kindOfNode(nodeId)).root === Root.Own ? ownClipOf(doc) : null;
  }

  $effect(() => {
    const only = selected.length === 1 ? selected[0] : null;
    if (only && coreFrames.some((f) => f.id === only)) {
      if (inside?.nodeId !== only) {
        inside = { nodeId: only, level: frameLevel() };
        picks = [];
      }
      const own = ownClipToPick(ownPicked, only, ownOf(only));
      if (own) {
        ownPicked = only;
        untrack(() => goInside(only, Gesture.Click, own));
      }
      return;
    }
    ownPicked = null;
    inside = null;
    picks = [];
  });

  const frameMode = $derived(readMode(editorMode.spec.edit));

  $effect(() => {
    const edit = editorMode.spec.edit;
    for (const session of savers.values()) {
      session.mode = readMode(edit);
      session.access = editorMode.spec.access;
    }
  });

  function saverOf(nodeId: string) {
    const held = savers.get(nodeId);
    const live = liveOf(nodeId);
    const frame = coreFrames.find((f) => f.id === nodeId);
    if (held || !live || !frame) {
      return held ?? null;
    }
    const url = `/p/${page.params.projectId}/c/${page.params.canvasId}/motion/${nodeId}`;
    const session: FrameEditSession = new FrameEditSession(
      { head: { version: frame.revision, doc: live.doc }, selection: [], mode: frameMode },
      {
        viewPath: () => [],
        playhead: () => frameOfLive(liveOf(nodeId) ?? live),
        show: (doc) => doc && liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? live), doc: previewDoc(doc, statePreview.picksOf(nodeId)) }),
        recorded: () => {
          settle.edited(nodeId);
          queueMicrotask(() => adoptAssets(nodeId));
          leaveHost(nodeId, session.history.present);
          queueMicrotask(() => settleHost(nodeId));
          autosize(nodeId);
        },
        stepped: () => props.onFrameStep?.({ back: () => stepFrame(nodeId, Step.Back), forward: () => stepFrame(nodeId, Step.Forward) }),
        saved: () => {
          liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? live), doc: previewDoc(session.history.present, statePreview.picksOf(nodeId)) });
          adoptAssets(nodeId);
        },
        landed: (from, to) => {
          const step = stepOf(nodeId, from, to);
          if (step) {
            presence?.landed(step);
          }
        },
        pull: async () => {},
        send: async (ops, version, summary) => {
          const form = new FormData();
          form.set('ops', JSON.stringify(ops));
          form.set('version', String(version));
          form.set('summary', summary);
          const result = await postPageAction(url, 'ops', form);
          return result.type === 'success' ? { ok: true, version: Number(result.data?.version), doc: result.data?.doc as LiveDoc['doc'] } : { ok: false, error: 'Save failed' };
        }
      }
    );
    session.access = editorMode.spec.access;
    const drawing = drawSaves.get(nodeId);
    if (drawing) {
      session.holdSave(drawing);
    }
    savers.set(nodeId, session);
    return session;
  }

  function adoptAssets(nodeId: string) {
    const live = liveOf(nodeId);
    const added = live ? missingAssets(live.doc, live.assets, assetUrl) : null;
    if (live && added) {
      liveDocs.set(nodeId, { ...live, assets: { ...live.assets, ...added } });
    }
  }

  const extras = new Map<string, FrameExtras>();

  function extrasOf(nodeId: string) {
    const held = extras.get(nodeId);
    const session = saverOf(nodeId);
    if (held || !session) {
      return held ?? null;
    }
    const made = new FrameExtras({ projectId: page.params.projectId ?? '', canvasId: page.params.canvasId ?? '', nodeId }, createSupabaseBrowserClient(), () => session.history.present, drawSaves.get(nodeId) ?? Promise.resolve(true));
    extras.set(nodeId, made);
    return made;
  }

  let frameDialog = $state<{ nodeId: string; dialog: FrameDialog } | null>(null);

  const dialogSession = $derived(frameDialog ? saverOf(frameDialog.nodeId) : null);
  const dialogExtras = $derived(frameDialog ? extrasOf(frameDialog.nodeId) : null);
  const dialogTokens = $derived(frameDialog ? (liveOf(frameDialog.nodeId)?.tokens ?? null) : null);

  function showDialogDoc(nodeId: string, doc: LiveDoc['doc'] | null) {
    const live = liveOf(nodeId);
    const shown = doc ?? dialogSession?.history.present;
    if (live && shown) {
      liveDocs.set(nodeId, { ...live, doc: shown });
    }
  }

  function closeDialog(nodeId: string) {
    showDialogDoc(nodeId, null);
    frameDialog = null;
  }

  let pickedPart = $state<string | null>(null);
  const soleFrame = $derived(selected.length === 1 && coreFrames.some((f) => f.id === selected[0]) ? selected[0] : null);
  const panelNodeId = $derived(inside ? inside.nodeId : soleFrame);
  const panelSession = $derived(panelNodeId ? saverOf(panelNodeId) : null);
  const panelTokens = $derived(panelNodeId ? (liveOf(panelNodeId)?.tokens ?? null) : null);
  const panelExtras = $derived(panelNodeId ? extrasOf(panelNodeId) : null);

  $effect(() => {
    void panelExtras?.load();
  });

  const remixOf = $derived(panelExtras?.data?.gallery.remixOf ?? null);

  const brandRemix = () => goto(handoffPath({ projectId: page.params.projectId ?? '', canvasId: page.params.canvasId ?? '' }, BRAND_REMIX_PROMPT));

  const presence = framePresence();
  const peering = presence ? new FramePeering(presence) : null;
  const pointedFrame = $derived(inside?.nodeId ?? soleFrame);
  const onCanvas = $derived(new Set((props.peers ?? []).filter((p) => p.cursor).map((p) => p.userId)));

  onMount(() => peering?.start());
  onMount(() => presence?.onHead(takeStep));
  onMount(lockOverscroll);

  $effect(() => {
    styleLibrary.found(libraryOf(coreFrames.flatMap((f) => liveOf(f.id)?.doc ?? [])));
  });

  function syncStyle(name: string, style: Style) {
    for (const frame of coreFrames.filter((f) => liveOf(f.id)?.doc.styles?.[name])) {
      const saver = saverOf(frame.id);
      const present = saver?.history.present;
      const synced = present && !sameValue(present.styles?.[name], style) ? syncedDoc(present, name, style) : null;
      if (synced) {
        commit(frame.id, { ok: true, doc: synced }, `Updated the ${name} style`);
      }
    }
  }

  function syncRename(from: string, to: string) {
    for (const frame of coreFrames.filter((f) => liveOf(f.id)?.doc.styles?.[from])) {
      const present = saverOf(frame.id)?.history.present;
      const renamed = present ? renameStyle(present, from, to) : null;
      if (renamed?.ok) {
        commit(frame.id, renamed, `Renamed the ${from} style to ${to}`);
      }
    }
  }

  function syncRemove(name: string) {
    for (const frame of coreFrames.filter((f) => liveOf(f.id)?.doc.styles?.[name])) {
      const present = saverOf(frame.id)?.history.present;
      const removed = present ? removeStyle(present, name) : null;
      if (removed?.ok) {
        commit(frame.id, removed, `Removed the ${name} style`);
      }
    }
  }

  onMount(() => {
    styleLibrary.connect({ push: syncStyle, rename: syncRename, remove: syncRemove });
    const projectId = page.params.projectId;
    void styleLibrary.open(projectId ? projectLibraryStore(projectId, LibraryKind.Style) : null);
    return () => {
      styleLibrary.connect(null);
      void styleLibrary.open(null);
    };
  });

  $effect(() => {
    variableLibrary.found(variableLibraryOf(coreFrames.flatMap((f) => liveOf(f.id)?.doc ?? [])));
  });

  const sharedShape = (c: Collection | undefined) => c && { modes: c.modes, vars: c.vars };

  function syncCollection(name: string, collection: Collection) {
    for (const frame of coreFrames.filter((f) => liveOf(f.id)?.doc.variables?.[name])) {
      const present = saverOf(frame.id)?.history.present;
      const synced = present && !sameValue(sharedShape(present.variables?.[name]), sharedShape(collection)) ? syncedCollection(present, name, collection) : null;
      if (synced) {
        commit(frame.id, { ok: true, doc: synced }, `Updated the ${name} variables`);
      }
    }
  }

  function syncRemoval(collection: string, variable: string) {
    for (const frame of coreFrames.filter((f) => liveOf(f.id)?.doc.variables?.[collection]?.vars[variable])) {
      const present = saverOf(frame.id)?.history.present;
      const removed = present ? removeVariable(present, collection, variable) : null;
      if (removed?.ok) {
        commit(frame.id, removed, `Removed ${collection}/${variable}`);
      }
    }
  }

  onMount(() => {
    variableLibrary.connect({ push: syncCollection, remove: syncRemoval });
    const projectId = page.params.projectId;
    void variableLibrary.open(projectId ? projectLibraryStore(projectId, LibraryKind.Variables) : null);
    return () => {
      variableLibrary.connect(null);
      void variableLibrary.open(null);
    };
  });

  $effect(() => {
    peering?.select(pointedFrame, picks);
  });

  function peerMeasure(nodeId: string, ids: readonly string[]) {
    const at = pickerOf(nodeId);
    return Promise.resolve(at ? peerBoxes(at.picker, ids) : {});
  }

  $effect(() => {
    layersSource.setGlyphs(new Map(coreFrames.flatMap((f) => (frameChrome(kindOfNode(f.id)).root === Root.Own ? [[f.id, elementGlyph(liveOf(f.id)?.doc.tracks.flatMap((t) => t.clips).find((c) => !c.parent))] as const] : []))));
    layersSource.setDocs(new Map(coreFrames.flatMap((f) => (liveOf(f.id) ? [[f.id, liveOf(f.id)!.doc] as const] : []))));
  });

  $effect(() => {
    panelSession?.select(picks);
  });

  $effect(() => {
    if (!panelNodeId || !panelSession || !panelTokens) {
      return;
    }
    frameProperties.publish(panelNodeId, panelSession, panelTokens, panelExtras);
    frameProperties.name = placed.find((t) => t.id === panelNodeId)?.displayName?.trim() || UNNAMED_FRAME;
    frameProperties.part = pickedPart;
    frameProperties.exportPicks = () => props.onExportElements?.(panelNodeId, picks);
    frameProperties.exportRows = (rows) => (picks.length ? props.onExportElementRows?.(panelNodeId, picks, rows) : props.onExportRows?.([panelNodeId], rows)) ?? Promise.resolve('Export failed');
    frameProperties.runAction = runSelectionAction;
    frameProperties.place = nodePlaceOf(panelNodeId);
    frameProperties.rename = props.onRename ? (name) => props.onRename?.(panelNodeId, name) : null;
    frameProperties.host = hostOf(panelNodeId);
    return () => frameProperties.clear();
  });

  $effect(() => {
    if (!selected.length || !spec.chrome) {
      return;
    }
    const ids = [...selected];
    selectionProperties.publish({
      summaries: selectedSummaries,
      choicesFor: props.modelChoicesFor,
      runQuote: props.runQuoteFor?.(ids) ?? null,
      onpropertychange: (patch) => props.onPropertyChange?.(ids, patch),
      onalign: (edge) => alignSelection(ids, edge),
      ondistribute: (axis) => placeTiles(distributeTiles(placedBoxes(ids), axis)),
      box: many.length ? { items: many, set: (field, value) => placeAll(many, withField(many, field, value)) } : null
    });
    return () => selectionProperties.clear();
  });

  const Step = { Back: 'back', Forward: 'forward' } as const;
  type Step = (typeof Step)[keyof typeof Step];

  function stepFrame(nodeId: string, step: Step) {
    const session = savers.get(nodeId);
    if (!session) {
      return;
    }
    leaveHost(nodeId, session.history.present);
    if (step === Step.Back) {
      session.undo();
    } else {
      session.redo();
    }
    arriveHost(nodeId, session.history.present);
    liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? { tokens: {} as LiveDoc['tokens'], assets: {} }), doc: session.history.present });
    if (inside?.nodeId === nodeId) {
      picks = picks.filter((id) => scopeOf(session.history.present, id));
    }
  }

  function commit(nodeId: string, result: OpResult, summary: string) {
    const session = saverOf(nodeId);
    session?.apply(result, summary);
    if (session && result.ok) {
      liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? { tokens: {} as LiveDoc['tokens'], assets: {} }), doc: previewDoc(session.history.present, statePreview.picksOf(nodeId)) });
    }
  }

  $effect(() => {
    for (const [nodeId, picks] of statePreview.byNode) {
      const session = untrack(() => savers.get(nodeId));
      const live = untrack(() => liveOf(nodeId));
      if (session && live) {
        untrack(() => liveDocs.set(nodeId, { ...live, doc: previewDoc(session.history.present, picks) }));
      }
    }
  });

  function variantMark(nodeId: string) {
    const mark = picks.length === 1 && !typing && !isComponentSet(nodeId) ? selectionMarks(nodeId)[0] : null;
    const saver = mark ? saverOf(nodeId) : null;
    const instance = mark && saver ? instanceOf(saver.history.present, mark.clip) : null;
    return mark && instance ? { rect: quadBox(mark.quad), compId: instance.compId } : null;
  }

  function addVariantAt(nodeId: string, compId: string) {
    const saver = saverOf(nodeId);
    if (saver) {
      commit(nodeId, appendVariant(saver.history.present, compId, () => crypto.randomUUID().slice(0, 8)), 'Added a variant');
    }
  }

  const onComponentsPage = $derived((page.data as { canvas?: { name?: string } }).canvas?.name === COMPONENTS_PAGE);

  const isComponentSet = (nodeId: string) => {
    const doc = onComponentsPage ? liveOf(nodeId)?.doc : null;
    return Boolean(doc && setMainOf(doc));
  };

  function addSetVariantAt(nodeId: string) {
    const saver = saverOf(nodeId);
    const tile = byId.get(nodeId);
    if (!saver || !tile) {
      return;
    }
    const before = saver.history.present;
    const grown = addSetVariant(before, () => crypto.randomUUID().slice(0, 8));
    commit(nodeId, grown, 'Added a variant');
    if (grown.ok && grown.doc.width !== before.width) {
      props.onNodeSize?.(nodeId, (tile.w * grown.doc.width) / before.width, tile.h);
    }
  }

  function setMainPicked(nodeId: string, clip: string | null): string | undefined {
    const doc = clip && isComponentSet(nodeId) ? saverOf(nodeId)?.history.present : null;
    const main = doc ? doc.tracks.flatMap((t) => t.clips).find((c) => c.id === clip) : null;
    return main?.component === 'Precomp' ? main.id : undefined;
  }

  function mainResizedTo(nodeId: string, clip: string, was: Box, to: Box) {
    const before = saverOf(nodeId)?.history.present;
    return before ? mainDragged(before, clip, { w: to.w - was.w, h: to.h - was.h }, was) : null;
  }

  function showMainResized(nodeId: string, clip: string, was: Box, to: Box) {
    const dragged = mainResizedTo(nodeId, clip, was, to);
    const live = liveOf(nodeId);
    if (!dragged?.result.ok || !live) {
      return;
    }
    liveDocs.set(nodeId, { ...live, doc: dragged.result.doc });
    overrides = new Map([[nodeId, { x: was.x, y: was.y, ...dragged.node }]]);
  }

  function unshowMainResized(nodeId: string) {
    const live = liveOf(nodeId);
    const present = saverOf(nodeId)?.history.present;
    if (live && present) {
      liveDocs.set(nodeId, { ...live, doc: present });
    }
  }

  function resizeSetMainBy(nodeId: string, clip: string, was: Box, to: Box) {
    const dragged = mainResizedTo(nodeId, clip, was, to);
    if (!dragged?.result.ok) {
      unshowMainResized(nodeId);
      return;
    }
    commit(nodeId, dragged.result, 'Resized the main component');
    props.onNodeSize?.(nodeId, dragged.node.w, dragged.node.h);
  }

  function editFrameDoc(nodeId: string, change: FrameDocEdit, summary: string): boolean {
    const live = liveOf(nodeId);
    if (!live || !saverOf(nodeId)) {
      return false;
    }
    const result = change(live.doc);
    commit(nodeId, result, summary);
    return result.ok;
  }

  const frameDocOf = (nodeId: string) => savers.get(nodeId)?.history.present ?? liveOf(nodeId)?.doc ?? null;

  function holdFrameDoc(held: HeldDoc, saved: Promise<boolean>) {
    const live = liveOf(held.nodeId);
    if (!live) {
      const like = liveOf(held.like);
      holdLive(held.nodeId, { doc: held.doc, tokens: like?.tokens ?? heldTokens() ?? FEEGA_TOKENS, assets: like?.assets ?? {} }, saved);
      adoptAssets(held.nodeId);
      return;
    }
    const session = saverOf(held.nodeId);
    const before = frameDocOf(held.nodeId) ?? live.doc;
    session?.adoptSaved(held.doc);
    session?.holdSave(saved);
    liveDocs.set(held.nodeId, { ...live, doc: held.doc, assets: { ...liveOf(held.like)?.assets, ...live.assets } });
    adoptAssets(held.nodeId);
    void saved.then((landed) => {
      const now = liveOf(held.nodeId);
      if (landed || !now) {
        return;
      }
      session?.adoptSaved(before);
      liveDocs.set(held.nodeId, { ...now, doc: before });
    });
  }

  function previewFrameDoc(nodeId: string, doc: MotionDoc | null) {
    const live = liveOf(nodeId);
    const shown = doc ?? frameDocOf(nodeId);
    if (live && shown && frameChrome(kindOfNode(nodeId)).resize === ResizePaint.Relaid) {
      liveDocs.set(nodeId, { ...live, doc: previewDoc(shown, statePreview.picksOf(nodeId)) });
    }
  }

  onMount(() => frameDocs.publish({ edit: editFrameDoc, doc: frameDocOf, hold: holdFrameDoc, preview: previewFrameDoc }));

  function startTrailer() {
    if (panelNodeId) {
      commit(panelNodeId, { ok: true, doc: trailerFrom(panelExtras?.assets ?? []) }, 'Started from the feega trailer');
    }
  }

  function pickerOf(nodeId: string) {
    const frame = coreFrames.find((f) => f.id === nodeId);
    const live = liveOf(nodeId);
    if (!frame || !live) {
      return null;
    }
    const picker = pickers.of(nodeId, live, () => liveOf(nodeId)?.playhead, reuseOf(nodeId));
    return { picker, space: picker.spaceOf(frame.box, byId.get(nodeId)?.rotation ?? 0, resizing.has(nodeId) ? FrameFit.Stretch : FrameFit.Contain), frame, live };
  }

  function editedView(nodeId: string) {
    const breakpointId = savers.get(nodeId)?.breakpoint ?? BASE_BREAKPOINT;
    return breakpointId === BASE_BREAKPOINT ? null : (bpViews.find((v) => v.nodeId === nodeId && v.breakpointId === breakpointId) ?? null);
  }

  function editPickerOf(nodeId: string) {
    const shown = editedView(nodeId);
    const live = shown ? viewLives.get(shown.frame.id) : null;
    if (!shown || !live) {
      return pickerOf(nodeId);
    }
    const picker = pickers.of(shown.frame.id, live, () => liveOf(nodeId)?.playhead, reuseOf(nodeId));
    return { picker, space: picker.spaceOf(shown.frame.box, 0), frame: shown.frame, live };
  }

  function viewPickerOf(overlayId: string) {
    const live = viewLives.get(overlayId);
    const shown = viewOf(overlayId);
    return live && shown ? { picker: pickers.of(overlayId, live, () => liveOf(shown.nodeId)?.playhead) } : null;
  }

  function marksIn(overlayId: string) {
    const shown = viewOf(overlayId);
    const nodeId = shown?.nodeId ?? overlayId;
    const breakpointId = shown?.breakpointId ?? BASE_BREAKPOINT;
    const picked = selectionMarks(nodeId);
    return (savers.get(nodeId)?.breakpoint ?? BASE_BREAKPOINT) === breakpointId ? picked : [];
  }

  let timed: string | null = null;

  function scrubTo(nodeId: string, frame: number) {
    const live = liveOf(nodeId);
    if (live) {
      timed = nodeId;
      liveDocs.set(nodeId, withPlayhead(live, frame));
    }
  }

  $effect(() => {
    const leaving = timed;
    const live = leaving && inside?.nodeId !== leaving ? liveOf(leaving) : null;
    if (leaving && live) {
      timed = null;
      liveDocs.set(leaving, withPlayhead(live, null));
    }
  });

  const kindOfNode = (id: string): FrameKind => {
    const node = summaries.get(id);
    return node && holdsDoc(node.type) ? docKindOf(node.type, node.data.kind) : FrameKind.Frame;
  };
  const typedFreeText = () => (typing && kindOfNode(typing.nodeId) === FrameKind.Element ? typing.nodeId : null);

  const timeline = $derived.by(() => {
    const nodeId = inside?.nodeId;
    const live = nodeId ? liveOf(nodeId) : null;
    const mode = nodeId && live ? frameMode : EditMode.Design;
    const access = nodeId ? frameTimeline(editorMode.timeline, frameChrome(kindOfNode(nodeId)).timeline, mode) : TimelineAccess.Hidden;
    return nodeId && live && access !== TimelineAccess.Hidden ? { nodeId, doc: timelineDoc(live.doc), frame: frameOfLive(live), access } : null;
  });

  const TIMELINE_CHANGE: Record<TimelineAccess, (nodeId: string) => (doc: LiveDoc['doc'], summary: string) => void> = {
    [TimelineAccess.Hidden]: () => () => {},
    [TimelineAccess.Scrub]: () => () => {},
    [TimelineAccess.Edit]: (nodeId) => (doc, summary) => commit(nodeId, { ok: true, doc }, summary)
  };

  function selectionMarks(nodeId: string) {
    const at = inside?.nodeId === nodeId ? editPickerOf(nodeId) : null;
    if (!at) {
      return [];
    }
    const kind = picks.length > 1 ? SelectionKind.Member : SelectionKind.Element;
    const onScreen = (p: Point): [number, number] => [(p.x - at.frame.box.x) * view.zoom, (p.y - at.frame.box.y) * view.zoom];
    return picks.flatMap((clip) => {
      const quad = at.picker.outlineQuad(clip, at.space);
      const own = findClip(at.live.doc, clip)?.clip;
      const pivot: [number, number] = [own?.transform.anchorX ?? TRANSFORM.anchorX.fallback, own?.transform.anchorY ?? TRANSFORM.anchorY.fallback];
      return quad ? [{ clip, kind, pivot, highlight: highlightOf(at.live.doc, clip), quad: quad.map(onScreen) }] : [];
    });
  }

  function gradientMark(nodeId: string) {
    const mark = picks.length === 1 && typing?.nodeId !== nodeId ? selectionMarks(nodeId)[0] : null;
    const saver = mark ? saverOf(nodeId) : null;
    const target = mark && saver ? gradientTarget(liveOf(nodeId)?.doc ?? saver.history.present, mark.clip) : null;
    return mark && target ? { clip: mark.clip, rect: quadBox(mark.quad), index: target.index, fill: target.fill } : null;
  }

  function dragGradient(nodeId: string, clip: string, index: number, fill: Fill) {
    const saver = saverOf(nodeId);
    const result = saver ? withFill(saver.history.present, clip, index, fill) : null;
    if (result?.ok) {
      liveDocs.set(nodeId, { ...(liveOf(nodeId) as LiveDoc), doc: result.doc });
    }
  }

  function dropGradient(nodeId: string, clip: string, index: number, fill: Fill) {
    const saver = saverOf(nodeId);
    if (saver) {
      commit(nodeId, withFill(saver.history.present, clip, index, fill), 'Edited gradient');
    }
  }

  type Cropping = { nodeId: string; clip: string; index: number; next: FillOf<FillType.Image> };
  let cropping = $state<Cropping | null>(null);

  function startCrop(nodeId: string, clip: string): boolean {
    const saver = saverOf(nodeId);
    const target = saver ? imageTarget(saver.history.present, clip) : null;
    if (!target) {
      return false;
    }
    cropping = { nodeId, clip, index: target.index, next: target.fill };
    return true;
  }

  function cropMark(nodeId: string) {
    const open = cropping?.nodeId === nodeId ? cropping : null;
    const mark = open && inside?.nodeId === nodeId ? selectionMarks(nodeId).find((m) => m.clip === open.clip) : null;
    const saver = mark ? saverOf(nodeId) : null;
    const target = saver ? imageTarget(saver.history.present, open!.clip) : null;
    const src = target ? (target.fill.src ?? liveOf(nodeId)?.assets[target.fill.assetId]) : null;
    return mark && target && src ? { rect: quadBox(mark.quad), fill: target.fill, src } : null;
  }

  function dragCrop(fill: FillOf<FillType.Image>) {
    const open = cropping;
    const saver = open ? saverOf(open.nodeId) : null;
    const result = open && saver ? withFill(saver.history.present, open.clip, open.index, fill) : null;
    if (open && result?.ok) {
      cropping = { ...open, next: fill };
      liveDocs.set(open.nodeId, { ...(liveOf(open.nodeId) as LiveDoc), doc: result.doc });
    }
  }

  function endCrop(apply: boolean) {
    const open = cropping;
    const saver = open ? saverOf(open.nodeId) : null;
    cropping = null;
    if (!open || !saver) {
      return;
    }
    if (apply) {
      commit(open.nodeId, withFill(saver.history.present, open.clip, open.index, open.next), 'Cropped image');
      return;
    }
    liveDocs.set(open.nodeId, { ...(liveOf(open.nodeId) as LiveDoc), doc: saver.history.present });
  }

  let cropAsks = 0;

  $effect(() => {
    const asked = cropRequest.asked;
    if (asked === cropAsks) {
      return;
    }
    cropAsks = asked;
    untrack(() => {
      if (inside && picks.length === 1) {
        startCrop(inside.nodeId, picks[0]);
      }
    });
  });

  function groupMark(nodeId: string): [number, number][] | null {
    const marks = selectionMarks(nodeId);
    if (marks.length < 2) {
      return null;
    }
    const xs = marks.flatMap((m) => m.quad.map(([x]) => x));
    const ys = marks.flatMap((m) => m.quad.map(([, y]) => y));
    const [left, top, right, bottom] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    return [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom]
    ];
  }


  function outlineBoxes(overlayId: string, doc: MotionDoc): Boxes {
    const at = frameViews.isOn(FrameView.Outlines) ? (viewOf(overlayId) ? viewPickerOf(overlayId) : pickerOf(overlayId)) : null;
    if (!at) {
      return {};
    }
    const ids = doc.tracks.flatMap((t) => t.clips.map((c) => c.id));
    return Object.fromEntries(ids.flatMap((id) => {
      const rect = at.picker.frameRect(id);
      return rect ? [[id, rect]] : [];
    }));
  }

  function toolsOf(nodeId: string) {
    const live = inside?.nodeId === nodeId ? liveOf(nodeId) : null;
    return live ? { doc: live.doc, frame: frameOfLive(live) } : null;
  }

  function deletePicks(): boolean {
    const nodeId = inside?.nodeId;
    const tools = nodeId && picks.length ? toolsOf(nodeId) : null;
    const at = tools ? scoped(tools.doc, picks, tools.frame) : null;
    const done = at ? barAction(Action.Delete, { doc: at.view, selection: at.ids, frame: at.frame, newId: () => crypto.randomUUID().slice(0, 8) }) : null;
    if (!nodeId || !at || !done) {
      return false;
    }
    const doc = at.merge(done.doc);
    picks = [];
    if (leftEmpty(kindOfNode(nodeId), doc)) {
      dropSelection([nodeId], []);
      return true;
    }
    commit(nodeId, { ok: true, doc }, done.summary);
    return true;
  }

  function leaveBuilder() {
    picks = [];
    frameBar.tool = DrawTool.Select;
  }

  function drawnInside(nodeId: string, id: string) {
    picks = [id];
    arrive(frameBar.tool === DrawTool.Text ? { nodeId, clip: id } : null);
    frameBar.tool = DrawTool.Select;
  }

  function marqueeRect(nodeId: string) {
    const m = bandDrag?.nodeId === nodeId ? bandDrag : null;
    const frame = coreFrames.find((f) => f.id === nodeId);
    if (!m || !frame) {
      return null;
    }
    const r = spanOf([m.from.x, m.from.y], [m.to.x, m.to.y]);
    return { left: (r.left - frame.box.x) * view.zoom, top: (r.top - frame.box.y) * view.zoom, width: r.width * view.zoom, height: r.height * view.zoom };
  }

  type Typing = { nodeId: string; clip: string; text: string; runs: TextRun[]; lists: ListItem[]; styled: boolean; base: RunStyle; caret: TextCaret; look: TextEditStyle; body: EditBody; typed: string };
  let typing = $state<Typing | null>(null);

  async function startTyping(nodeId: string, clip: string, ahead?: TypeAhead) {
    const saver = saverOf(nodeId);
    const at = pickerOf(nodeId);
    const doc = saver?.history.present;
    const scope = doc && at ? textScope(doc, clip, frameOfLive(at.live)) : null;
    const found = scope ? findClip(scope.view, scope.id)?.clip : null;
    const size = at?.picker.frameSize();
    if (editedView(nodeId) || !saver || !at || !doc || !scope || !found || !size || !editsText(scope.view, scope.id)) {
      ahead?.release();
      return;
    }
    const laid = await caretSource(() => at.live.tokens, () => at.live.assets)(scope.view, scope.id);
    if (!laid || saver.history.present !== doc) {
      ahead?.release();
      return;
    }
    const caret = { ...laid, matrix: mul2d(scope.place, laid.matrix) };
    const look = textEditStyle({ clip: found as MotionClip, doc: scope.view, tokens: at.live.tokens, frame: size, scale: 1 });
    typing = { nodeId, clip, caret, look, text: String((found.props as { text?: unknown }).text ?? ''), runs: runsOfClip(found), lists: listsOfClip(found), styled: styledKind(found), base: baseStyle(found), body: editBody(found, scope.view, at.live.tokens), typed: ahead?.release() ?? '' };
    liveDocs.set(nodeId, { ...at.live, doc: scope.merge(hideText(scope.view, scope.id)) });
  }

  let typeOnArrival = $state<{ nodeId: string; clip: string | null } | null>(null);
  const typeAhead = new TypeAhead();

  function arrive(next: { nodeId: string; clip: string | null } | null) {
    typeOnArrival = next;
    if (next) {
      typeAhead.hold(performance.now());
    }
  }

  const drawSaves = new Map<string, Promise<boolean>>();

  const heldTokens = (): LiveDoc['tokens'] | null => [...liveDocs.map.values()][0]?.tokens ?? [...fetched.values()][0]?.live.tokens ?? null;

  async function adoptTokens(id: string) {
    const res = await fetch(coreSource(id), { cache: 'no-store' }).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { tokens: LiveDoc['tokens']; assets?: LiveDoc['assets'] } | null) : null;
    const live = liveOf(id);
    if (body && live) {
      liveDocs.set(id, { ...live, tokens: body.tokens, assets: { ...body.assets, ...live.assets } });
    }
  }

  function holdLive(id: string, live: LiveDoc, saved: Promise<boolean>, after?: () => void) {
    liveDocs.set(id, live);
    drawSaves.set(id, saved);
    savers.get(id)?.holdSave(saved);
    void saved.then((landed) => {
      drawSaves.delete(id);
      if (!landed) {
        liveDocs.clear(id);
        return;
      }
      after?.();
    });
  }

  function seed(drawing: Drawing | null | undefined) {
    if (!drawing?.doc) {
      return;
    }
    const tokens = heldTokens();
    holdLive(drawing.id, { doc: drawing.doc, tokens: tokens ?? FEEGA_TOKENS, assets: {} }, drawing.saved, tokens ? undefined : () => void adoptTokens(drawing.id));
  }

  function duplicateTiles(ids: string[], offset?: Offset) {
    const docs = new Map(ids.flatMap((id) => (liveOf(id) ? [[id, liveOf(id)!] as const] : [])));
    const ready = ids.every((id) => !holdsDoc(byId.get(id)?.kind ?? '') || docs.has(id));
    const made = props.onDuplicate?.(ids, offset, ready ? CopyShown.Now : CopyShown.OnSave);
    for (const { from, to } of ready && made ? made.copies : []) {
      const live = docs.get(from);
      if (live) {
        holdLive(to, { ...live, playhead: undefined }, made!.saved);
      }
    }
  }

  function frameUnderDrawing(drawn: DrawnWire) {
    const anchor = drawnAnchor(drawn);
    const hosts = (id: string) => !domIds.has(id) && kindOfNode(id) === FrameKind.Frame && !byId.get(id)?.rotation && coreFrames.some((f) => f.id === id && !f.linked);
    const id = anchor ? hitIndex.allAt(anchor).find(hosts) : null;
    const frame = id ? coreFrames.find((f) => f.id === id) : null;
    const live = frame ? liveOf(frame.id) : null;
    return frame && live && saverOf(frame.id) ? { frame, live } : null;
  }

  function drawIntoFrame(drawn: DrawnWire): boolean {
    const under = frameUnderDrawing(drawn);
    if (!under) {
      return false;
    }
    const { frame, live } = under;
    const clip = crypto.randomUUID().slice(0, 8);
    const made = drawnInFrame(live.doc, frame.box, drawn, drawStart(frameMode, frameOfLive(live)), clip);
    if (!made.ok) {
      return false;
    }
    commit(frame.id, made, DRAW_SUMMARY[drawn.tool]);
    select([frame.id]);
    goInside(frame.id, Gesture.Click, clip);
    arrive(drawn.tool === DrawTool.Text ? { nodeId: frame.id, clip } : null);
    return true;
  }

  function drawOnCanvas(drawn: DrawnWire) {
    frameBar.tool = DrawTool.Select;
    if (drawIntoFrame(drawn)) {
      return;
    }
    const drawing = props.onDraw?.(drawn);
    seed(drawing);
    arrive(drawn.tool === DrawTool.Text && drawing ? { nodeId: drawing.id, clip: null } : null);
  }

  $effect(() => {
    const wanted = typeOnArrival;
    const saver = wanted ? saverOf(wanted.nodeId) : null;
    const clip = saver?.history.present.tracks.flatMap((t) => t.clips).find((c) => (wanted?.clip ? c.id === wanted.clip : c.component === 'Text'));
    if (!wanted || !clip || !pickerOf(wanted.nodeId)) {
      return;
    }
    typeOnArrival = null;
    untrack(() => void startTyping(wanted.nodeId, clip.id, typeAhead));
  });

  function stopTyping(text: string, runs: TextRun[], lists: ListItem[]) {
    const open = typing;
    const saver = open ? saverOf(open.nodeId) : null;
    typing = null;
    if (!open || !saver) {
      return;
    }
    const result = commitScoped(saver.history.present, open.clip, text, runs, lists, frameOfLive({ doc: saver.history.present, playhead: liveOf(open.nodeId)?.playhead }));
    liveDocs.set(open.nodeId, { ...(liveOf(open.nodeId) as LiveDoc), doc: saver.history.present });
    if (result.ok && (text !== open.text || JSON.stringify(runs) !== JSON.stringify(open.runs) || JSON.stringify(lists) !== JSON.stringify(open.lists))) {
      commit(open.nodeId, result, 'Edited text');
    }
  }

  function typingMark(nodeId: string) {
    const open = typing?.nodeId === nodeId ? typing : null;
    const at = open ? pickerOf(nodeId) : null;
    if (!open || !at) {
      return null;
    }
    const z = view.zoom;
    const stage = at.space.toWorld({ left: 0, top: 0, width: 1, height: 1 });
    const screen: [number, number, number, number, number, number] = [stage.w * z, 0, 0, stage.w * z, (stage.x - at.frame.box.x) * z, (stage.y - at.frame.box.y) * z];
    return { text: open.text, typed: open.typed, runs: open.runs, lists: open.lists, styled: open.styled, base: open.base, clip: open.clip, layout: editLayout(open.caret, screen), look: open.look, body: open.body };
  }

  function nodePlaceOf(nodeId: string): NodePlace | null {
    const tile = byId.get(nodeId);
    if (!tile) {
      return null;
    }
    return { x: tile.x, y: tile.y, w: tile.w, h: tile.h, rotation: tile.rotation ?? 0, set: (x, y) => props.onMove?.(nodeId, x, y), resize: (w, h) => props.onResize?.(nodeId, w, h), turn: (degrees) => props.onRotate?.(nodeId, degrees - (tile.rotation ?? 0)), flip: (flip) => flipNodes([nodeId], flip), align: alignInHolder(nodeId) };
  }

  const hostLedger = new HostLedger();

  function hostBoxOf(nodeId: string): HostBox | null {
    const t = byId.get(nodeId);
    return t && frameChrome(kindOfNode(nodeId)).root === Root.Own ? { x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation ?? 0 } : null;
  }

  function hostOf(nodeId: string): ElementHost | null {
    const clipId = ownOf(nodeId);
    const box = hostBoxOf(nodeId);
    if (!clipId || !box) {
      return null;
    }
    return { clipId, box, move: (x, y) => placeTiles([{ id: nodeId, x, y }]), resize: (w, h) => props.onResize?.(nodeId, w, h), turn: (degrees) => props.onRotate?.(nodeId, degrees - box.rotation) };
  }

  function leaveHost(nodeId: string, doc: MotionDoc) {
    const box = hostBoxOf(nodeId);
    if (box) {
      hostLedger.leave(doc, box);
    }
  }

  function arriveHost(nodeId: string, doc: MotionDoc) {
    const box = hostBoxOf(nodeId);
    const back = box ? hostLedger.arrive(doc, box) : null;
    if (back) {
      props.onSettle?.(nodeId, back);
    }
  }

  function settleHost(nodeId: string) {
    const saver = savers.get(nodeId);
    const live = liveOf(nodeId);
    const box = hostBoxOf(nodeId);
    const settled = saver && live && box ? settleElement(saver.history.present, box) : null;
    if (!saver || !live || !settled) {
      return;
    }
    saver.amendRoot(settled.doc, 'Placed the element');
    liveDocs.set(nodeId, { ...live, doc: previewDoc(settled.doc, statePreview.picksOf(nodeId)) });
    props.onSettle?.(nodeId, settled.box);
  }

  const autosizing = new Map<string, ReturnType<typeof setTimeout>>();

  function autosize(nodeId: string) {
    clearTimeout(autosizing.get(nodeId));
    autosizing.set(nodeId, setTimeout(() => void fitTextBoxes(nodeId), 0));
  }

  async function fitTextBoxes(nodeId: string) {
    const saver = saverOf(nodeId);
    const live = liveOf(nodeId);
    const row = byId.get(nodeId);
    if (!saver || !live || !row || typing?.nodeId === nodeId) {
      return;
    }
    const doc = saver.history.present;
    const fit = await measuredTexts(doc, live.tokens, live.assets, kindOfNode(nodeId), { w: row.w, h: row.h });
    if (!fit || saver.history.present !== doc) {
      return;
    }
    applyTextFit(fit, { amend: (fitted) => saver.amendRoot(fitted, 'Fitted text'), show: (fitted) => liveDocs.set(nodeId, { ...live, doc: fitted }), place: (node) => props.onPlace?.(nodeId, node.w, node.h) });
  }

  let frameGuides = $state<{ nodeId: string; guides: Guide[]; gaps: Gap[]; drop?: DropLine | null } | null>(null);

  function frameReach(at: NonNullable<ReturnType<typeof pickerOf>>): number {
    const a = at.picker.framePoint({ x: 0, y: 0 }, at.space);
    const b = at.picker.framePoint({ x: SNAP_SCREEN_PX / view.zoom, y: 0 }, at.space);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  const UNIT_SQUARE: Quad = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ];

  function resizeOf(nodeId: string, unit: [number, number], start: Point, main?: string): Active {
    const t = byId.get(nodeId)!;
    return { kind: GestureKind.Resize, id: t.id, unit, rotation: t.rotation ?? 0, start, box: { x: t.x, y: t.y, w: t.w, h: t.h }, min: { w: t.minW ?? 1, h: t.minH ?? 1 }, main };
  }

  function rotateOf(nodeId: string, start: Point): Active {
    const t = byId.get(nodeId)!;
    return { kind: GestureKind.Rotate, id: t.id, centre: { x: t.x + t.w / 2, y: t.y + t.h / 2 }, start, base: t.rotation ?? 0, degrees: t.rotation ?? 0 };
  }

  function rotateHost(nodeId: string, e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    downAt = local(e);
    captureId = e.pointerId;
    holdSelection(true);
    active = rotateOf(nodeId, toWorld(view, local(e)));
    gesturing = true;
  }

  const MANY_MIN = { w: 1, h: 1 };

  function grabMany(grip: Grip, handle: number, e: PointerEvent) {
    const turns = grip === Grip.Rotate && selectedBoxes.every((t) => t.rotatable);
    if (!manyBox || e.button !== PRIMARY_BUTTON || (grip !== Grip.Scale && !turns)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    downAt = local(e);
    captureId = e.pointerId;
    holdSelection(true);
    const start = toWorld(view, local(e));
    const centre = { x: manyBox.x + manyBox.w / 2, y: manyBox.y + manyBox.h / 2 };
    active = turns ? { kind: GestureKind.TurnMany, centre, start, box: manyBox, items: many } : { kind: GestureKind.ResizeMany, unit: handlesOf(UNIT_SQUARE)[handle].unit, start, box: manyBox, items: many };
    gesturing = true;
  }

  function placeAll(before: Placed[], after: Placed[]) {
    props.onPlaceMany?.(before.map((b, i) => ({ before: b, after: after[i] })));
  }

  function showMany(next: Placed[]) {
    overrides = new Map(next.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));
    turning = new Map(next.map((n) => [n.id, n.rotation]));
    props.onLive?.(next.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })));
  }

  function endMany(items: Placed[]) {
    props.onLive?.([]);
    const changes = items.flatMap((before) => {
      const box = overrides.get(before.id);
      return box ? [{ before, after: { ...before, ...box, rotation: turning.get(before.id) ?? before.rotation } }] : [];
    });
    if (changes.length) {
      props.onPlaceMany?.(changes);
    }
    spin = null;
    turning = new Map();
    settleOverrides();
  }

  function resizeHost(nodeId: string, handle: number, e: PointerEvent, main?: string) {
    e.preventDefault();
    e.stopPropagation();
    downAt = local(e);
    captureId = e.pointerId;
    holdSelection(true);
    active = resizeOf(nodeId, handlesOf(UNIT_SQUARE)[handle].unit, toWorld(view, local(e)), main);
    gesturing = true;
  }

  function pickOnRelease(nodeId: string, grip: Grip, e: PointerEvent) {
    const w = toWorld(view, local(e));
    const hit = grip === Grip.Move ? (e.shiftKey ? elementAt(w, Reach.Top) : elementAt(w, Reach.Top, clickPick)) : null;
    if (hit?.nodeId !== nodeId) {
      return;
    }
    const next = e.shiftKey ? toggleId(picks, hit.clip) : [hit.clip];
    if (next.join() !== picks.join()) {
      pickMany(nodeId, next);
    }
  }

  function grab(nodeId: string, clip: string | null, grip: Grip, handle: number, e: PointerEvent) {
    if (grip === Grip.Scale && e.button === PRIMARY_BUTTON && frameChrome(kindOfNode(nodeId)).dragsHost && byId.has(nodeId)) {
      resizeHost(nodeId, handle, e, setMainPicked(nodeId, clip));
      return;
    }
    if (grip === Grip.Rotate && e.button === PRIMARY_BUTTON && frameChrome(kindOfNode(nodeId)).dragsHost && byId.get(nodeId)?.rotatable) {
      rotateHost(nodeId, e);
      return;
    }
    if (grip === Grip.Move && (e.metaKey || e.ctrlKey) && (extendPick(e, toWorld(view, local(e))) || pickElement(e, toWorld(view, local(e))))) {
      e.stopPropagation();
      return;
    }
    const under = grip === Grip.Move ? elementAt(toWorld(view, local(e)), Reach.Top) : null;
    const instead = under?.nodeId === nodeId ? grabbedInstead(picks, under.clip) : null;
    if (instead) {
      pickMany(nodeId, [instead]);
      clip = instead;
    }
    const at = editPickerOf(nodeId);
    const saver = saverOf(nodeId);
    if (!at || !saver || e.button !== 0 || frameChrome(kindOfNode(nodeId)).dragsHost) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dropHover();
    const source = saver.history.present;
    const shownView = editedView(nodeId);
    const start = shownView ? at.live.doc : source;
    const lifted = (doc: MotionDoc) => (shownView ? liftViewEdit(source, shownView.breakpointId, start, doc) : doc);
    const inScope = scoped(start, clip && !picks.includes(clip) ? [clip] : picks, frameOfLive({ doc: start, playhead: at.live.playhead }));
    if (!inScope || holdsLock(inScope.view, inScope.ids)) {
      return;
    }
    const work = (grip === Grip.Move && e.altKey ? altCopies(inScope.view, inScope.ids, () => crypto.randomUUID().slice(0, 8)) : null) ?? { doc: inScope.view, ids: inScope.ids };
    const boxes = guessedBoxes(withAutoLayout(work.doc));
    const framePt = (ev: PointerEvent): Pt => inScope.toView(at.picker.framePoint(toWorld(view, local(ev)), at.space));
    const from = framePt(e);
    const reach = frameReach(at);
    const snapOf = (ev: PointerEvent) => (ev.ctrlKey ? SnapMode.Off : frameViews.isOn(FrameView.PixelGrid) ? SnapMode.Pixels : SnapMode.Guides);
    let result: OpResult | null = null;
    let carried = false;
    let started = false;
    const down = local(e);
    const box = at.frame.box;
    const edited = { left: box.x, top: box.y, width: box.w, height: box.h };

    const carry = (ev: PointerEvent): Carry => carryOf({ down, now: local(ev), started, frame: edited, world: toWorld(view, local(ev)) });
    const stackChild = grip === Grip.Move && work.ids.length === 1 && stackPlaced(work.doc, work.ids[0]) ? work.ids[0] : null;
    const joinable = grip === Grip.Move && work.ids.length === 1 && !stackChild;

    const leaving = (ev: PointerEvent, now: Carry): ElementOut | null => {
      const [clipId] = work.ids;
      if (now !== Carry.Out || grip !== Grip.Move || work.ids.length !== 1 || work.doc !== inScope.view) {
        return null;
      }
      const b = boxes[clipId];
      const { width, height } = work.doc;
      return { clipId, client: { x: ev.clientX, y: ev.clientY }, box: b ? { left: b.left / width, top: b.top / height, width: b.width / width, height: b.height / height } : null };
    };

    const move = (ev: PointerEvent) => {
      const now = carry(ev);
      if (now === Carry.Held) {
        return;
      }
      started = true;
      const out = leaving(ev, now);
      if (out || carried) {
        props.onElementOut?.(nodeId, out ?? { clipId: '', client: { x: ev.clientX, y: ev.clientY }, box: null }, out ? DragPhase.Over : DragPhase.Back);
        carried = !!out;
      }
      if (stackChild) {
        const to = framePt(ev);
        const dropped = dragInStack(work.doc, stackChild, boxes, to);
        result = dropped.result.ok ? { ok: true, doc: lifted(inScope.merge(dropped.result.doc)) } : dropped.result;
        frameGuides = { nodeId, guides: [], gaps: [], drop: dropped.line };
        const followed = followCursor(work.doc, stackChild, [to[0] - from[0], to[1] - from[1]]);
        if (followed.ok) {
          liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? at.live), doc: lifted(inScope.merge(followed.doc)) });
        }
        return;
      }
      const dragged = dragClips({ doc: work.doc, ids: work.ids, frame: inScope.frame, boxes, grip, handle, from, to: framePt(ev), keys: { shift: ev.shiftKey, alt: ev.altKey, ctrl: ev.ctrlKey }, reach, snap: snapOf(ev), mode: saver.mode });
      const shown = dragged.result.ok ? { ok: true as const, doc: lifted(inScope.merge(dragged.result.doc)) } : dragged.result;
      const into = joinable ? dropInStack(work.doc, work.ids[0], boxes, framePt(ev)) : null;
      result = into?.result.ok ? { ok: true, doc: lifted(inScope.merge(into.result.doc)) } : shown;
      frameGuides = into?.result.ok ? { nodeId, guides: [], gaps: [], drop: into.line } : { nodeId, guides: dragged.guides, gaps: dragged.gaps };
      if (shown.ok) {
        liveDocs.set(nodeId, { ...(liveOf(nodeId) ?? at.live), doc: shown.doc });
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      frameGuides = null;
      if (!started) {
        pickOnRelease(nodeId, grip, ev);
        return;
      }
      const out = leaving(ev, carry(ev));
      if (out) {
        liveDocs.clear(nodeId);
        props.onElementOut?.(nodeId, out, DragPhase.Drop);
        return;
      }
      if (!result?.ok) {
        liveDocs.set(nodeId, at.live);
        return;
      }
      commit(nodeId, result, GRIP_SUMMARY[grip]);
      if (work.doc !== inScope.view) {
        pickMany(nodeId, inScope.scene(work.ids));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function frameArea(nodeId: string) {
    const at = pickerOf(nodeId);
    if (!at) {
      return null;
    }
    const size = at.picker.frameSize();
    const r = at.space.toWorld({ left: 0, top: 0, width: size.width, height: size.height });
    return { size, rect: { left: (r.x - at.frame.box.x) * view.zoom, top: (r.y - at.frame.box.y) * view.zoom, width: r.w * view.zoom, height: r.h * view.zoom } };
  }

  function measuredIn(nodeId: string): Gap[] {
    const live = (altHeld || editorMode.spec.inspector === ModeInspector.Code) && inside?.nodeId === nodeId && pickHover?.nodeId === nodeId && !frameGuides ? liveOf(nodeId) : null;
    if (!live || !pickHover) {
      return [];
    }
    return measuredGaps(live.doc, frameOfLive(live), guessedBoxes(withAutoLayout(live.doc)), picks, pickHover.clip);
  }

  $effect(() => {
    const nodeId = inside?.nodeId;
    if (!nodeId || !liveOf(nodeId)) {
      return;
    }
    return layersSource.publishVideo(
      videoSide({
        nodeId,
        doc: () => liveOf(nodeId)!.doc,
        selection: () => (inside?.nodeId === nodeId ? picks : []),
        part: () => (inside?.nodeId === nodeId ? pickedPart : null),
        select: (ids) => pickMany(nodeId, ids),
        selectPart: (clipId, part) => {
          pickMany(nodeId, [clipId]);
          pickedPart = part;
        },
        edit: (result, summary) => commit(nodeId, result, summary),
        run: (id) => void runFrameAction(id)
      })
    );
  });

  function placeComment(w: Point) {
    const id = topNodeAt(w);
    const tile = id ? byId.get(id) : null;
    props.onComment?.(commentPlacement(w, tile ? { id: tile.id, x: tile.x, y: tile.y } : null));
  }

  function linkPrototype(targetId: string): boolean {
    const draft = prototypeLink.draft;
    const source = inside?.nodeId;
    const live = source ? liveOf(source) : null;
    const onCanvas = coreFrames.some((f) => f.id === targetId && kindOfNode(f.id) === FrameKind.Frame);
    if (!draft || !source || !live || source === targetId || !onCanvas) {
      return false;
    }
    commit(source, linkToFrame(live.doc, draft, targetId, () => crypto.randomUUID().slice(0, 8)), 'Linked to a frame');
    prototypeLink.stop();
    return true;
  }

  function linkElements(): Map<string, WorldRect> {
    return new Map(
      arrowLinks.flatMap((l) => {
        const at = pickerOf(l.from);
        const box = at?.picker.outline(l.clip, at.space);
        return box ? [[elementKey(l.from, l.clip), box] as const] : [];
      })
    );
  }

  function pickedHandle(): WorldRect | null {
    const at = inside && picks.length === 1 ? pickerOf(inside.nodeId) : null;
    return at ? at.picker.outline(picks[0], at.space) : null;
  }

  function openLink(link: PrototypeLink) {
    select([link.from]);
    goInside(link.from, Gesture.Click, link.clip);
  }

  function dragLink() {
    if (!picks.length) {
      return;
    }
    prototypeLink.aim({ clipId: picks[0], interactionId: null });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', up);
      const node = topNodeAt(toWorld(view, local(ev)));
      if (!node || !linkPrototype(node)) {
        prototypeLink.stop();
      }
    };
    window.addEventListener('pointerup', up);
  }

  let hostPress: PointerEvent | null = null;

  function onDown(e: PointerEvent) {
    takeCamera();
    dropHover();
    markBusy();
    measureSurface();
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) {
        cancelGesture();
        pinch = pinchOf();
        return;
      }
    }
    const w = toWorld(view, p);
    if (props.commenting && e.button === 0 && e.pointerType !== 'touch') {
      e.preventDefault();
      placeComment(w);
      return;
    }
    const target = e.target as HTMLElement;
    const hit = boxHit(hitAt(w), target);
    if (prototypeLink.draft && e.button === PRIMARY_BUTTON && hit.kind === HitKind.Node && linkPrototype(hit.nodeId)) {
      e.preventDefault();
      return;
    }
    if (hit.kind === HitKind.Empty && viewAt(bpViews, w) && pickElement(e, w)) {
      e.preventDefault();
      return;
    }
    const press = hit.kind === HitKind.Node ? pressOn({ selected, inside: inside?.nodeId ?? null, picks }, hit.nodeId, reachOf(e)) : Press.Child;
    hostPress = press === Press.Host ? e : null;
    if (hit.kind === HitKind.Node && (extendPick(e, w) || (press === Press.Child && pickElement(e, w)))) {
      e.preventDefault();
      return;
    }
    if (hit.kind === HitKind.Node && e.button === PRIMARY_BUTTON && inside?.nodeId === hit.nodeId && !frameChrome(kindOfNode(hit.nodeId)).dragsHost) {
      goInside(hit.nodeId, Gesture.Click, null);
    }
    const inDom = target.closest('.gpu-dom-node');
    if (inDom && hit.kind !== HitKind.Port && hit.kind !== HitKind.Corner && hit.kind !== HitKind.Rotate && ownsPress(target, e.clientY)) {
      return;
    }
    if (e.button === 2 && hit.kind !== HitKind.Empty) {
      return;
    }
    const kind = gestureFor(hit, { pointer: pointerOf(e), button: e.button, shift: e.shiftKey, space, mode });
    downAt = p;
    suppressMenu = false;
    captureId = e.pointerId;
    holdSelection(true);
    menuAt = null;
    picked = null;
    startGesture(kind, hit, w, e);
  }

  function nodeHeld(nodeId: string): boolean {
    if (byId.get(nodeId)?.locked) {
      return true;
    }
    const live = liveOf(nodeId);
    return !!live &&frameChrome(kindOfNode(nodeId)).root === Root.Own && ownLocked(live.doc);
  }

  function startGesture(kind: GestureKind, hit: Hit, w: Point, e: PointerEvent) {
    const START: Record<GestureKind, () => Active | null> = {
      [GestureKind.Pan]: () => {
        fling.release(e.timeStamp);
        fling.sample(local(e), e.timeStamp);
        return { kind: GestureKind.Pan, last: local(e), moved: false };
      },
      [GestureKind.Drag]: () => {
        if (hit.kind !== HitKind.Node) {
          return null;
        }
        const ids = selected.includes(hit.nodeId) && !e.shiftKey ? selected : clicked(selected, hit.nodeId, e.shiftKey || e.metaKey || e.ctrlKey);
        const origins = new Map(ids.flatMap((id) => (byId.get(id) && !nodeHeld(id) ? [[id, { x: byId.get(id)!.x, y: byId.get(id)!.y }] as const] : [])));
        return { kind: GestureKind.Drag, id: hit.nodeId, start: w, origins, moved: false, toggle: e.shiftKey || e.metaKey || e.ctrlKey };
      },
      [GestureKind.Resize]: () => {
        if (hit.kind !== HitKind.Corner || nodeHeld(hit.nodeId)) {
          return null;
        }
        return resizeOf(hit.nodeId, hit.unit, w);
      },
      [GestureKind.Rotate]: () => {
        if (hit.kind !== HitKind.Rotate || nodeHeld(hit.nodeId)) {
          return null;
        }
        return rotateOf(hit.nodeId, w);
      },
      [GestureKind.Marquee]: () => ({ kind: GestureKind.Marquee, start: w, base: selected, additive: e.shiftKey || e.metaKey || e.ctrlKey, moved: false }),
      [GestureKind.Connect]: () => {
        if (hit.kind !== HitKind.Port) {
          return null;
        }
        const from = ports.find((p) => p.nodeId === hit.nodeId && p.handle === hit.handle && Math.hypot(p.x - w.x, p.y - w.y) * view.zoom < 12) ?? portAt(ports, w, view.zoom);
        if (!from) {
          return null;
        }
        ghost = { from, at: w, ok: false };
        return { kind: GestureKind.Connect, from };
      },
      [GestureKind.PickEdge]: () => (hit.kind === HitKind.Edge ? { kind: GestureKind.PickEdge, edgeId: hit.edgeId } : null),
      [GestureKind.ResizeMany]: () => null,
      [GestureKind.TurnMany]: () => null
    };
    active = START[kind]();
    gesturing = active !== null;
  }

  function pinchOf(): { dist: number; mid: Point } {
    const [a, b] = [...touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function candidate(from: Port, w: Point): Connection | null {
    const port = portAt(ports, w, view.zoom);
    const node = port?.nodeId ?? topNodeAt(w);
    if (!node || node === from.nodeId) {
      return null;
    }
    if (from.side === PortSide.Out) {
      return { source: from.nodeId, sourceHandle: from.handle, target: node, targetHandle: port?.side === PortSide.In ? port.handle : null };
    }
    return { source: node, sourceHandle: port?.side === PortSide.Out ? port.handle : null, target: from.nodeId, targetHandle: from.handle };
  }

  function onMove(e: PointerEvent) {
    if (active || e.buttons) {
      markBusy();
    }
    const p = local(e);
    props.onPointer?.(toWorld(view, p));
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      if (pinch && touches.size === 2) {
        const next = pinchOf();
        props.onUserPan?.();
        view = panBy(zoomAt(view, next.mid, next.dist / pinch.dist), { x: next.mid.x - pinch.mid.x, y: next.mid.y - pinch.mid.y });
        pinch = next;
        return;
      }
    }
    const w = toWorld(view, p);
    if (!active) {
      hovered = e.pointerType === 'mouse' ? topNodeAt(w) : null;
      hoverChrome = e.pointerType === 'mouse' ? (hovered ?? portAt(ports, w, view.zoom)?.nodeId ?? null) : null;
      if (e.pointerType === 'mouse' && !e.buttons) {
        hoverElement(w, reachOf(e));
        hoverHandle(w);
      }
      return;
    }
    const far = pastSlop(downAt, p);
    if (far && captureId !== null) {
      surface?.setPointerCapture(captureId);
      captureId = null;
    }
    const MOVE: Record<GestureKind, (a: Active) => void> = {
      [GestureKind.Pan]: (a) => {
        if (a.kind !== GestureKind.Pan) {
          return;
        }
        props.onUserPan?.();
        view = panBy(view, { x: p.x - a.last.x, y: p.y - a.last.y });
        fling.sample(p, e.timeStamp);
        a.last = p;
        a.moved ||= far;
        suppressMenu ||= far;
      },
      [GestureKind.Drag]: (a) => {
        if (a.kind !== GestureKind.Drag || (!far && !a.moved) || !editable) {
          return;
        }
        if (!a.moved) {
          a.moved = true;
          if (!selected.includes(a.id) || a.toggle) {
            select([...a.origins.keys()]);
          }
        }
        const next = new Map<string, Box>();
        const raw = movedBy(a.origins, { x: w.x - a.start.x, y: w.y - a.start.y });
        const moved = snapMoves(raw);
        const all = new Map(tiles.map((t) => [t.id, { x: t.x, y: t.y }]));
        const follow = moved.flatMap((m) => followGroup(all, m.id, m, byId.get(m.id)?.members ?? []));
        for (const m of [...moved, ...follow]) {
          const t = byId.get(m.id);
          if (t) {
            next.set(m.id, { x: m.x, y: m.y, w: t.w, h: t.h });
          }
        }
        if (e.altKey) {
          copies = next;
          overrides = new Map();
        } else {
          overrides = next;
          copies = new Map();
        }
        props.onLive?.(moved.map((m) => ({ id: m.id, x: m.x, y: m.y })));
        props.onTileDragOver?.([...a.origins.keys()], pointOf(e));
      },
      [GestureKind.Resize]: (a) => {
        if (a.kind !== GestureKind.Resize || (!far && !resizing.has(a.id) && !overrides.has(a.id))) {
          return;
        }
        const free = resizedAt(a.box, a.unit, { x: w.x - a.start.x, y: w.y - a.start.y }, a.min, { shift: e.shiftKey, alt: e.altKey }, a.rotation);
        const box = snapResized(a, free, e.shiftKey, e.altKey);
        if (a.main) {
          a.dragged = box;
          showMainResized(a.id, a.main, a.box, box);
          return;
        }
        resizing = resizing.has(a.id) ? resizing : new Set([a.id]);
        overrides = new Map([[a.id, box]]);
        props.onLive?.([{ id: a.id, x: box.x, y: box.y, w: box.w, h: box.h }]);
      },
      [GestureKind.Rotate]: (a) => {
        if (a.kind !== GestureKind.Rotate || (!far && a.degrees === a.base)) {
          return;
        }
        const target = a.base + dragAngle(a.centre, a.start, w);
        a.degrees = e.shiftKey ? Math.round(target / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG : target;
        turning = byId.get(a.id)?.members?.length ? new Map() : new Map([[a.id, a.degrees]]);
      },
      [GestureKind.ResizeMany]: (a) => {
        if (a.kind !== GestureKind.ResizeMany || (!far && !overrides.size)) {
          return;
        }
        const to = resizedAt(a.box, a.unit, { x: w.x - a.start.x, y: w.y - a.start.y }, MANY_MIN, { shift: e.shiftKey, alt: e.altKey }, 0);
        showMany(scaledTo(a.items, a.box, to));
      },
      [GestureKind.TurnMany]: (a) => {
        if (a.kind !== GestureKind.TurnMany || (!far && !spin)) {
          return;
        }
        const swept = dragAngle(a.centre, a.start, w);
        const degrees = e.shiftKey ? Math.round(swept / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG : swept;
        spin = { box: a.box, degrees };
        showMany(turnedAbout(a.items, a.centre, degrees));
      },
      [GestureKind.Marquee]: (a) => {
        if (a.kind !== GestureKind.Marquee || (!far && !a.moved)) {
          return;
        }
        a.moved = true;
        marquee = marqueeBox(a.start, w);
        select(marqueePick(placed, marquee, a.base, a.additive));
      },
      [GestureKind.Connect]: (a) => {
        if (a.kind !== GestureKind.Connect) {
          return;
        }
        const c = candidate(a.from, w);
        const why = c ? connectionRefusal(placed, edges, lookup, c) : '';
        refusal = why || null;
        ghost = { from: a.from, at: w, ok: c !== null && why === null };
      },
      [GestureKind.PickEdge]: () => {}
    };
    MOVE[active.kind](active);
  }

  function holdSelection(on: boolean) {
    document.documentElement.classList.toggle('canvas-gesture', on);
    if (on) {
      getSelection()?.removeAllRanges();
    }
  }

  function onUp(e: PointerEvent) {
    holdSelection(false);
    touches.delete(e.pointerId);
    captureId = null;
    if (touches.size < 2) {
      pinch = null;
    }
    const a = active;
    active = null;
    gesturing = false;
    resizing = new Set();
    if (!a) {
      return;
    }
    const w = toWorld(view, local(e));
    const END: Record<GestureKind, () => void> = {
      [GestureKind.Pan]: () => {
        if (a.kind === GestureKind.Pan && !a.moved && e.button === 0) {
          clearSelection();
        }
        if (a.kind === GestureKind.Pan && a.moved && glidesAfterPan(pointerOf(e))) {
          startGlide();
        }
      },
      [GestureKind.Drag]: () => {
        if (a.kind !== GestureKind.Drag) {
          return;
        }
        const press = hostPress;
        hostPress = null;
        if (!a.moved && press && pickElement(press, toWorld(view, local(press)))) {
          return;
        }
        if (!a.moved) {
          clickNode(a.id, a.toggle);
          return;
        }
        endDrag([...a.origins.keys()], e);
      },
      [GestureKind.Resize]: () => {
        if (a.kind !== GestureKind.Resize) {
          return;
        }
        props.onLive?.([]);
        snapGuides = [];
        const box = overrides.get(a.id);
        if (a.main && a.dragged) {
          resizeSetMainBy(a.id, a.main, a.box, a.dragged);
        } else if (box) {
          props.onResizeEnd?.(a.id, a.box, { x: box.x, y: box.y, w: box.w, h: box.h });
        }
        settleOverrides();
      },
      [GestureKind.Rotate]: () => {
        turning = new Map();
        if (a.kind === GestureKind.Rotate && a.degrees !== a.base) {
          props.onRotate?.(a.id, a.degrees - a.base);
        }
      },
      [GestureKind.Marquee]: () => {
        marquee = null;
        if (a.kind === GestureKind.Marquee && !a.moved) {
          clearSelection();
        }
      },
      [GestureKind.Connect]: () => {
        if (a.kind !== GestureKind.Connect) {
          return;
        }
        const c = candidate(a.from, w);
        ghost = null;
        refusal = null;
        if (!c || connectionRefusal(placed, edges, lookup, c) !== null) {
          return;
        }
        const landing = landingOf(placed, lookup, c);
        if (landing) {
          props.onConnect?.(landing.source, landing.target, landing.kind, landing.targetHandle, landing.sourceHandle);
        }
      },
      [GestureKind.ResizeMany]: () => a.kind === GestureKind.ResizeMany && endMany(a.items),
      [GestureKind.TurnMany]: () => a.kind === GestureKind.TurnMany && endMany(a.items),
      [GestureKind.PickEdge]: () => {
        if (a.kind !== GestureKind.PickEdge) {
          return;
        }
        const edge = edges.find((x) => x.id === a.edgeId);
        selectedEdge = a.edgeId;
        select([]);
        if (edge) {
          picked = { edge, screen: { x: e.clientX, y: e.clientY } };
        }
      }
    };
    END[a.kind]();
  }

  function cancelGesture() {
    if (active?.kind === GestureKind.Resize && active.main) {
      unshowMainResized(active.id);
    }
    active = null;
    turning = new Map();
    spin = null;
    gesturing = false;
    resizing = new Set();
    marquee = null;
    ghost = null;
    refusal = null;
    settleOverrides();
  }

  function settleOverrides() {
    overrides = new Map();
    copies = new Map();
  }

  function clearSelection() {
    selectedEdge = null;
    targeting = null;
    select([]);
  }

  function clickNode(id: string, toggle: boolean) {
    props.onNodeClicked?.(id);
    selectedEdge = null;
    if (targeting) {
      if (!targeting.includes(id)) {
        props.onConnectExisting?.(targeting, id);
        targeting = null;
      }
      return;
    }
    select(clicked(selected, id, toggle));
  }

  function endDrag(ids: string[], e: PointerEvent) {
    snapGuides = [];
    snapSpacing = [];
    props.onLive?.([]);
    const asScene = sceneDrop(ids, (id) => liveOf(id)?.doc ?? null, frameUnderPointer(pointOf(e), ids[0] ?? null));
    if (asScene && props.onInsertScene) {
      settleOverrides();
      props.onInsertScene(asScene);
      return;
    }
    if (props.onTileDrop?.(ids, pointOf(e)) === DropVerdict.Taken) {
      settleOverrides();
      return;
    }
    const grabbed = copies.get(ids[0]) ?? overrides.get(ids[0]);
    const copyOffset = e.altKey && grabbed ? dragOffset(new Map(tiles.map((t) => [t.id, { x: t.x, y: t.y }])), { id: ids[0], position: grabbed }) : undefined;
    if (copyOffset && props.onDuplicate) {
      settleOverrides();
      duplicateTiles(ids, copyOffset);
      return;
    }
    const moves = ids.flatMap((id) => (overrides.get(id) ? [{ id, x: overrides.get(id)!.x, y: overrides.get(id)!.y }] : []));
    props.onMoveEnd?.(moves);
    for (const m of moves) {
      props.onMove?.(m.id, m.x, m.y);
    }
    settleOverrides();
  }

  $effect(() => {
    const el = surface;
    if (!el) {
      return;
    }
    return watchPinch(el, (factor, x, y) => {
      takeCamera();
      markBusy();
      view = zoomAt(view, local({ clientX: x, clientY: y }), factor);
    });
  });

  function onWheel(e: WheelEvent) {
    takeCamera();
    markBusy();
    props.onUserPan?.();
    const target = e.target as HTMLElement;
    if (target.closest('.gpu-dom-node .nowheel')) {
      return;
    }
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      view = zoomAt(view, p, Math.exp(-e.deltaY * WHEEL_ZOOM));
      return;
    }
    if (!spec.flow.panOnScroll) {
      view = zoomAt(view, p, Math.exp(-e.deltaY * WHEEL_ZOOM));
      return;
    }
    view = panBy(view, { x: -e.deltaX, y: -e.deltaY });
  }


  const SNAP_SCREEN_PX = 6;
  let snapGuides = $state<SnapGuide[]>([]);
  const corePeers = $derived(coreType ? (props.peers ?? []).filter((p) => !p.chat) : []);
  const stackOrder = $derived(placed.map((t) => t.id));
  const viewZoom = $derived(view.zoom);
  const coreTheme = $derived(coreLook ? { ...coreLook, panel: coreLook.paper } : null);
  const coreOverlay = $derived(
    coreTheme && coreType
      ? overlayOf({
          curves,
          selected,
          selectedEdge,
          marquee,
          guides: snapGuides,
          zoom: viewZoom,
          theme: coreTheme,
          glyphs: coreType.glyphs,
          peers: corePeers.flatMap((p) => (p.cursor ? [{ id: p.sessionId, name: displayName(p.name), color: p.colour, at: p.cursor }] : [])),
          outlines: corePeers.length ? peerOutlines(props.peers ?? [], (id) => byId.get(id) ?? null).map((o) => ({ key: o.key, box: o.rect, color: o.colour })) : [],
          ghost: ghost ? { curve: ghost.from.side === PortSide.Out ? wireCurve(ghost.from, ghost.at) : wireCurve(ghost.at, ghost.from), ok: ghost.ok } : null,
          hovered: hovered && !selected.includes(hovered) && layersSource.hovered?.nodeId !== hovered ? (byId.get(hovered) ?? null) : null,
          running: placed.filter((t) => !handedOver(t) && isRunning(summaries.get(t.id)?.data ?? {})).map((t) => ({ ...t, radius: cardRadiusOf(t.kind ?? '') })),
          chrome: coreChrome
        })
      : NO_OVERLAY
  );
  let snapSpacing = $state<SpacingGap[]>([]);
  let altHeld = $state(false);

  function snapMoves(raw: TileMove[]): TileMove[] {
    const ids = new Set(raw.map((m) => m.id));
    const rects = raw.flatMap((m) => (byId.get(m.id) ? [{ id: m.id, x: m.x, y: m.y, w: byId.get(m.id)!.w, h: byId.get(m.id)!.h }] : []));
    const others = tiles.filter((t) => !ids.has(t.id)).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
    const snap = snapDrag(rects, others, SNAP_SCREEN_PX / view.zoom);
    snapGuides = snap.guides;
    snapSpacing = snap.spacing;
    const at = new Map(snap.moves.map((m) => [m.id, m]));
    return raw.map((m) => at.get(m.id) ?? m);
  }

  function snapResized(a: Extract<Active, { kind: GestureKind.Resize }>, free: Box, locked: boolean, symmetric: boolean): Box {
    snapGuides = [];
    if (a.rotation || symmetric) {
      return free;
    }
    const others = tiles.filter((t) => t.id !== a.id).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
    const snap = snapResize(free, a.unit, others, SNAP_SCREEN_PX / view.zoom, locked);
    snapGuides = snap.guides;
    return snap.box.w < a.min.w || snap.box.h < a.min.h ? free : snap.box;
  }

  const measured = $derived.by(() => {
    const over = hovered && altHeld ? byId.get(hovered) : null;
    return over ? tileGaps(selectedBoxes, over) : [];
  });

  const placedBoxes = (ids: string[]) => ids.flatMap((id) => (byId.get(id) ? [{ id, x: byId.get(id)!.x, y: byId.get(id)!.y, width: byId.get(id)!.w, height: byId.get(id)!.h }] : []));

  function placeTiles(moves: TileMove[]) {
    if (!moves.length) {
      return;
    }
    props.onMoveEnd?.(moves);
    for (const m of moves) {
      props.onMove?.(m.id, m.x, m.y);
    }
  }

  const alignSelection = (ids: string[], edge: Edge) => placeTiles(alignTiles(placedBoxes(ids), edge));

  const holderOf = (id: string) => placed.find((t) => t.members?.includes(id)) ?? null;

  function alignInHolder(id: string): ((edge: Edge) => void) | null {
    const holder = holderOf(id);
    const [tile] = placedBoxes([id]);
    return holder && tile ? (edge) => placeTiles(alignWithin(tile, { id: holder.id, x: holder.x, y: holder.y, width: holder.w, height: holder.h }, edge)) : null;
  }

  const FLIP_SUMMARY: Record<Flip, string> = { [Flip.Horizontal]: 'Flipped horizontally', [Flip.Vertical]: 'Flipped vertically' };

  const nodeBox = (id: string): Placed | null => {
    const t = byId.get(id);
    return t ? { id, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation ?? 0 } : null;
  };

  function flipOwn(id: string, flip: Flip, rotation: number) {
    const box = nodeBox(id);
    const session = saverOf(id);
    if (!box) {
      return;
    }
    mirrorAround(byId.get(id)?.members ?? [], box, flip);
    if (session) {
      commit(id, { ok: true, doc: flipStage(session.history.present, flip) }, FLIP_SUMMARY[flip]);
    }
    if (rotation !== box.rotation) {
      props.onRotate?.(id, rotation - box.rotation);
    }
  }

  function mirrorAround(ids: readonly string[], about: Placed, flip: Flip) {
    const boxes = ids.flatMap((id) => nodeBox(id) ?? []);
    const mirrored = mirrorGroup(about, boxes, flip);
    placeTiles(mirrored.filter((m, i) => m.x !== boxes[i].x || m.y !== boxes[i].y).map(({ id, x, y }) => ({ id, x, y })));
    for (const m of mirrored) {
      flipOwn(m.id, flip, m.rotation);
    }
  }

  function flipNodes(ids: readonly string[], flip: Flip) {
    const flippable = ids.filter((id) => holdsDoc(summaries.get(id)?.type ?? '') && !byId.get(id)?.locked);
    const boxes = flippable.flatMap((id) => nodeBox(id) ?? []);
    if (!boxes.length) {
      return;
    }
    const [left, top] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))];
    const about: Placed = boxes.length === 1 ? boxes[0] : { id: '', x: left, y: top, w: Math.max(...boxes.map((b) => b.x + b.w)) - left, h: Math.max(...boxes.map((b) => b.y + b.h)) - top, rotation: 0 };
    const run = () => mirrorAround(flippable, about, flip);
    if (props.onBatch) {
      props.onBatch(run);
      return;
    }
    run();
  }

  function stackFrameNode(id: string): boolean {
    const session = kindOfNode(id) === FrameKind.Frame ? saverOf(id) : null;
    const result = session ? stackFrame(session.history.present, crypto.randomUUID().slice(0, 8)) : null;
    if (!result?.ok) {
      return false;
    }
    commit(id, result, 'Added auto layout');
    return true;
  }
  const alignRun = (id: AlignActionId) => (ids: string[]) => alignHere(ids, ALIGN_EDGE[id]);

  function selectSibling(direction: Direction) {
    const next = siblingOf(placed.map((t) => t.id), selected, direction);
    if (next) {
      select([next]);
    }
  }

  let menuLayers = $state<{ id: string; label: string }[]>([]);
  const tileLabel = (t: Tile) => t.displayName || NODE_KIND_LABEL[t.kind as keyof typeof NODE_KIND_LABEL] || t.kind || t.id;

  function layersAt(at: Point): { id: string; label: string }[] {
    return tilesAt(placed, toFlow(at)).flatMap((id) => (byId.get(id) ? [{ id, label: tileLabel(byId.get(id)!) }] : []));
  }

  function openMenu(id: string, at: Point) {
    if (!selected.includes(id)) {
      select([id]);
    }
    menuLayers = layersAt(at);
    menuAt = at;
  }

  function openMenuAt(at: Point) {
    const e = { clientX: at.x, clientY: at.y };
    if (suppressMenu || !spec.chrome || openElementMenu(e)) {
      return;
    }
    const node = topNodeAt(toWorld(view, local(e)));
    if (node) {
      openMenu(node, at);
      return;
    }
    if (selected.length) {
      menuAt = at;
      menuLayers = layersAt(menuAt);
    }
  }

  function dropSelection(ids: string[], edgeIds: string[]) {
    picked = null;
    for (const id of edgeIds) {
      props.onEdgeDelete?.(id);
    }
    if (ids.length) {
      props.onDelete?.(ids);
    }
  }

  function viewCentre(): Point {
    const s = screenSize();
    return toFlow({ x: s.left + s.width / 2, y: s.top + s.height / 2 });
  }

  const zoomStep = (factor: number) => {
    const s = screenSize();
    view = zoomAt(view, { x: s.width / 2, y: s.height / 2 }, factor);
  };

  const ZOOM_RUN: Record<ZoomStep, () => void> = {
    [ZoomStep.In]: () => zoomStep(STEP_ZOOM),
    [ZoomStep.Out]: () => zoomStep(1 / STEP_ZOOM),
    [ZoomStep.Fit]: () => fitTo(placed, FitPurpose.Command)
  };

  const pageZoom: CanvasZoom = {
    step: (step) => {
      if (keyRegion.current === Region.Canvas) {
        ZOOM_RUN[step]();
      }
    },
    scaleBy: (factor) => zoomStep(factor)
  };

  function pickedHost(): HostBox & { id: string } | null {
    const nodeId = inside?.nodeId;
    const box = nodeId && picks.length === 1 && picks[0] === ownOf(nodeId) ? hostBoxOf(nodeId) : null;
    return box && nodeId ? { ...box, id: nodeId } : null;
  }

  function nudgePicks(dx: number, dy: number): boolean {
    const host = pickedHost();
    if (host) {
      placeTiles([{ id: host.id, x: host.x + dx, y: host.y + dy }]);
      return true;
    }
    const nodeId = inside?.nodeId;
    const tools = nodeId && picks.length ? toolsOf(nodeId) : null;
    if (!nodeId || !tools) {
      return false;
    }
    const at = scoped(tools.doc, picks, tools.frame);
    const result = at ? nudgeClips(at.view, at.ids, at.frame, [dx, dy], savers.get(nodeId)?.mode ?? EditMode.Design) : null;
    if (at && result?.ok) {
      commit(nodeId, { ok: true, doc: at.merge(result.doc) }, GRIP_SUMMARY[Grip.Move]);
    }
    return true;
  }

  function alignPicks(edge: Edge): boolean {
    const nodeId = inside?.nodeId;
    const tools = nodeId && picks.length ? toolsOf(nodeId) : null;
    if (!nodeId || !tools) {
      return false;
    }
    const at = scoped(tools.doc, picks, tools.frame);
    const result = at ? alignSpace(at.view, at.ids, at.frame, propBoxes(at.view), edge, savers.get(nodeId)?.mode ?? EditMode.Design) : null;
    if (at && result?.ok) {
      commit(nodeId, { ok: true, doc: at.merge(result.doc) }, `Aligned ${edge}`);
    }
    return true;
  }

  function alignHere(ids: string[], edge: Edge) {
    if (!alignPicks(edge)) {
      alignSelection(ids, edge);
    }
  }

  function nudge(dx: number, dy: number) {
    if (nudgePicks(dx, dy)) {
      return;
    }
    for (const id of selected) {
      const t = byId.get(id);
      if (t && !t.locked) {
        props.onMove?.(id, t.x + dx, t.y + dy);
      }
    }
  }

  const KEY_RUN: Record<CanvasCommand['id'], (c: CanvasCommand) => void> = {
    opacity: (c) => c.id === 'opacity' && fadeTiles(selected, c.opacity),
    nudge: (c) => c.id === 'nudge' && nudge(c.dx, c.dy),
    align: (c) => c.id === 'align' && alignHere(selected, c.edge),
    tidy: () => placeTiles(tidyTiles(placedBoxes(selected))),
    'wrap-stack': () => (selected.length === 1 && stackFrameNode(selected[0])) || (shownFor('wrap-stack', selectedSummaries) && props.onWrapStack?.(selected)),
    flip: (c) => c.id === 'flip' && flipNodes(selected, c.flip),
    'edit-mode': () => editorMode.toggleMotion(),
    'code-mode': () => editorMode.toggleCode(),
    timeline: () => editorMode.toggleTimeline(),
    enter: () => enterSelected(selected, summaries),
    'select-next': () => selectSibling(Direction.Next),
    'select-previous': () => selectSibling(Direction.Previous),
    tool: (c) => {
      if (c.id === 'tool') {
        frameBar.tool = c.tool;
      }
    },
    section: () => props.onSection?.(selected),
    'delete-keep': () => selected.length && props.onDelete?.(selected, DeleteMode.KeepContents),
    delete: () => deletePicks() || ((selected.length || selectedEdge) && dropSelection(selected, selectedEdge ? [selectedEdge] : [])),
    comment: () => props.onCommenting?.(!props.commenting),
    deselect: () => {
      props.onCommenting?.(false);
      clearSelection();
    },
    'select-all': () => select(placed.map((t) => t.id)),
    fit: () => fitTo(placed, FitPurpose.Command),
    'zoom-actual': () => {
      const s = screenSize();
      view = zoomAt(view, { x: s.width / 2, y: s.height / 2 }, 1 / view.zoom);
    },
    'zoom-selection': zoomToSelection,
    'zoom-in': () => zoomStep(STEP_ZOOM),
    'zoom-out': () => zoomStep(1 / STEP_ZOOM),
    duplicate: () => selected.length && duplicateTiles(selected),
    copy: () => void copySystem(),
    paste: () => undefined,
    undo: () => props.onUndo?.(),
    redo: () => props.onRedo?.(),
    group: () => props.onGroup?.(selected),
    ungroup: () => props.onUngroup?.(selected),
    'bring-front': () => props.onRestack?.(selected, Stack.Front),
    'send-back': () => props.onRestack?.(selected, Stack.Back),
    'toggle-hidden': () => selected.length && props.onToggleFlag?.(selected, NodeFlag.Hidden),
    'toggle-locked': () => selected.length && props.onToggleFlag?.(selected, NodeFlag.Locked),
    help: () => (shortcutHelp.open = true),
    export: () => selected.length && SELECTION_RUN.export(selected),
    view: (c) => {
      if (c.id === 'view') {
        frameViews.flip(c.view);
      }
    }
  };

  $effect(() => {
    zoomLevel.show(view.zoom);
  });

  $effect(() => {
    const asked = zoomRequest.current;
    if (asked) {
      untrack(() => runPaletteCommand(asked.command));
    }
  });

  function fadeTiles(ids: readonly string[], opacity: number) {
    for (const id of ids) {
      const session = saverOf(id);
      if (session) {
        commit(id, tileFaded(session.history.present, opacity), `Opacity ${Math.round(opacity * 100)}%`);
      }
    }
  }

  function runPaletteCommand(command: Command) {
    if (inside?.level.clip && picks.length && canRunInFrame(command)) {
      void runFrameAction(command);
      return;
    }
    const canvasCommand = CANVAS_COMMAND_OF[command];
    if (canvasCommand) {
      KEY_RUN[canvasCommand.id](canvasCommand);
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (frameDialog) {
      return;
    }
    if (!isTypingTarget(e.target) && typeAhead.take(e, performance.now())) {
      e.preventDefault();
      return;
    }
    markBusy();
    altHeld = e.altKey;
    if (e.key === ' ' && !(e.target as HTMLElement).closest?.(INTERACTIVE)) {
      space = true;
    }
    if (cropping && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      endCrop(e.key === 'Enter');
      return;
    }
    const up = climbsUp(e);
    const group = up && inside && picks.length === 1 ? groupOfPick(inside.nodeId) : null;
    if (inside && group) {
      pickMany(inside.nodeId, [group]);
      return;
    }
    if (up && inside?.level.clip) {
      goInside(inside.nodeId, Gesture.Leave, null);
      return;
    }
    if (e.key === 'Escape') {
      picked = null;
      refusal = null;
      connectPickerAt = null;
      targeting = null;
    }
    const entered = e.key === 'Enter' && !typing && inside?.level.clip && !(e.target as HTMLElement).closest?.(INTERACTIVE);
    if (entered) {
      e.preventDefault();
      void startTyping(inside!.nodeId, inside!.level.clip!);
      startCrop(inside!.nodeId, inside!.level.clip!);
      return;
    }
    if (!spec.chrome || keyRegion.current !== Region.Canvas) {
      return;
    }
    const frameAction = inside?.level.clip && picks.length && !typing ? frameKeyAction(e) : null;
    if (frameAction) {
      e.preventDefault();
      void runFrameAction(frameAction);
      return;
    }
    const command = matchCanvasShortcut(e, frameMode);
    if (!command) {
      return;
    }
    if (preventable(command) && !NATIVE_CLIPBOARD.has(command.id)) {
      e.preventDefault();
    }
    KEY_RUN[command.id](command);
  }

  const NATIVE_CLIPBOARD = new Set(['copy', 'paste']);
  let pointer: Point | null = null;

  function clipboardTarget(e: ClipboardEvent): boolean {
    return Boolean(spec.chrome && !frameDialog && keyRegion.current === Region.Canvas && e.clipboardData && !isTypingTarget(e.target));
  }

  const framePicks = (): string[] => (inside && picks.length && frameChrome(kindOfNode(inside.nodeId)).root !== Root.Own ? picks : []);

  function clipOfSelection(): ClipboardPayload | null {
    const tools = inside && framePicks().length ? toolsOf(inside.nodeId) : null;
    if (inside && tools) {
      const elements = copyElements(tools.doc, picks);
      elementClipboard.copyElements(inside.nodeId, [...picks], elements);
      return { elements: elementClipboard.elements! };
    }
    return selected.length ? (props.onClip?.(selected) ?? null) : null;
  }

  const CLIP_TEXT = ' ';

  function copySystem() {
    const payload = clipOfSelection();
    return payload ? writeSystem(clipboardHtml(payload), CLIP_TEXT) : false;
  }

  function onCopy(e: ClipboardEvent, cut: boolean) {
    const payload = clipboardTarget(e) ? clipOfSelection() : null;
    if (!payload) {
      return;
    }
    e.preventDefault();
    e.clipboardData!.setData(HTML_MIME, clipboardHtml(payload));
    e.clipboardData!.setData(TEXT_MIME, CLIP_TEXT);
    if (cut) {
      void ((framePicks().length && deletePicks()) || dropSelection(selected, []));
    }
  }

  function pasteAt(): Point {
    const s = screenSize();
    const inView = pointer && pointer.x >= s.left && pointer.x <= s.left + s.width && pointer.y >= s.top && pointer.y <= s.top + s.height;
    return inView ? toFlow(pointer!) : viewCentre();
  }

  const IN_FRAME: { [K in Pasted]?: (data: Extract<PasteData<File>, { kind: K }>) => FramePaste } = {
    [Pasted.Svg]: ({ svg }) => ({ svg }),
    [Pasted.Text]: ({ text }) => ({ text }),
    [Pasted.Figma]: ({ html }) => ({ figma: html })
  };
  const PASTED_SUMMARY = 'Pasted';

  function pasteInFrame(data: PasteData<File>, at: Point): boolean {
    const paste = (IN_FRAME[data.kind] as ((d: PasteData<File>) => FramePaste) | undefined)?.(data);
    const hit = paste ? framePickAt(at) : null;
    const saver = hit && frameChrome(kindOfNode(hit.nodeId)).takesDrops ? saverOf(hit.nodeId) : null;
    if (!paste || !hit || !saver) {
      return false;
    }
    const doc = saver.history.present;
    const [x0, y0] = hit.picker.framePoint(at, hit.space);
    const [x1, y1] = hit.picker.framePoint({ x: at.x + 1, y: at.y }, hit.space);
    const done = pastedInFrame(doc, paste, hit.picker.unitAt(at, hit.space), Math.hypot(x1 - x0, y1 - y0), frameOfLive({ doc, playhead: liveOf(hit.nodeId)?.playhead }), () => crypto.randomUUID().slice(0, 8));
    if (!done) {
      return false;
    }
    select([hit.nodeId]);
    commit(hit.nodeId, { ok: true, doc: done.doc }, PASTED_SUMMARY);
    pickMany(hit.nodeId, done.selection);
    refusal = null;
    props.onFigmaPaste?.({ skipped: done.skipped ?? [], images: done.images?.length ?? 0, loading: Boolean(done.images?.length && done.fileKey) });
    if (done.images?.length && done.fileKey) {
      void fillFigmaImages({ nodeId: hit.nodeId, fileKey: done.fileKey, images: done.images });
    }
    return true;
  }

  const FIGMA_SESSION_TRIES = 20;
  const FIGMA_SESSION_WAIT_MS = 250;
  const FIGMA_FILLED_SUMMARY = 'Filled Figma images';
  const figmaStarted = new Set<FigmaJob>();

  async function sessionOnceLoaded(nodeId: string) {
    for (let tries = 0; tries < FIGMA_SESSION_TRIES; tries++) {
      const session = saverOf(nodeId);
      if (session) {
        return session;
      }
      await new Promise((resolve) => setTimeout(resolve, FIGMA_SESSION_WAIT_MS));
    }
    return null;
  }

  async function fillFigmaImages(job: FigmaJob) {
    const got = await figmaImageAssets({ projectId: page.params.projectId ?? '', fileKey: job.fileKey, hashes: job.images.map((i) => i.hash) });
    props.onFigmaImages?.(got);
    if (got.outcome !== ImagesOutcome.Filled || !Object.keys(got.assets).length) {
      return;
    }
    const session = await sessionOnceLoaded(job.nodeId);
    if (!session) {
      return;
    }
    const shown = Object.fromEntries(Object.values(got.assets).map((id) => [id, assetUrl(id)]));
    liveDocs.set(job.nodeId, { ...(liveOf(job.nodeId) as LiveDoc), assets: { ...liveOf(job.nodeId)?.assets, ...shown } });
    commit(job.nodeId, { ok: true, doc: imagesFilled(session.history.present, job.images, got.assets) }, FIGMA_FILLED_SUMMARY);
  }

  $effect(() => {
    for (const job of props.figmaJobs ?? []) {
      if (!figmaStarted.has(job)) {
        figmaStarted.add(job);
        void fillFigmaImages(job);
      }
    }
  });

  function pasteFrom(source: PasteSource<File> | null, at: Point) {
    const data = source ? readPaste(source) : null;
    if (data && pasteInFrame(data, at)) {
      return;
    }
    if (data) {
      props.onPasteData?.(data, at);
      return;
    }
    props.onPaste?.(at);
  }

  async function insertImageInFrame(file: File) {
    const nodeId = soleFrame;
    const session = nodeId ? saverOf(nodeId) : null;
    const extras = nodeId ? extrasOf(nodeId) : null;
    if (!nodeId || !session || !extras || !frameChrome(kindOfNode(nodeId)).takesDrops) {
      return;
    }
    const size = await sizeOfImage(file);
    const pendingId = `${PENDING_ASSET}${crypto.randomUUID()}`;
    const pending = imageInFrame(session.history.present, { assetId: pendingId, name: file.name, ...size });
    if (!pending.ok) {
      return;
    }
    const local = URL.createObjectURL(file);
    const uploading = extras.uploadMedia(file, () => undefined);
    session.holdSave(uploading);
    commit(nodeId, pending, 'Inserted image');
    const shown = (assetId: string) => liveDocs.set(nodeId, { ...(liveOf(nodeId) as LiveDoc), assets: { ...liveOf(nodeId)?.assets, [assetId]: local } });
    shown(pendingId);

    const uploaded = await uploading;
    if (!uploaded.ok) {
      session.undo();
      liveDocs.set(nodeId, { ...(liveOf(nodeId) as LiveDoc), doc: session.history.present });
      props.onfail?.(uploaded.error);
      return;
    }
    session.settleHeld(withAssetSwapped(session.history.present, pendingId, uploaded.asset.id));
    liveDocs.set(nodeId, { ...(liveOf(nodeId) as LiveDoc), doc: session.history.present });
    shown(uploaded.asset.id);
  }

  async function onPasteEvent(e: ClipboardEvent) {
    if (!clipboardTarget(e)) {
      return;
    }
    e.preventDefault();
    const at = pasteAt();
    const component = parseComponentClip(e.clipboardData!.getData(TEXT_MIME));
    if (component) {
      void dropComponent(component, at, soleFrame);
      return;
    }
    pasteFrom(await eventSource(e.clipboardData!), at);
  }

  async function pasteSystem(at: Point) {
    pasteFrom(await systemSource(), at);
  }

  const SELECTION_RUN: Record<CanvasActionId, (ids: string[]) => void> = {
    'tidy-up': (ids) => placeTiles(tidyTiles(placedBoxes(ids))),
    stack: (ids) => placeTiles(stackTiles(placedBoxes(ids), STACK_GAP)),
    'wrap-stack': (ids) => props.onWrapStack?.(ids),
    'section-selection': (ids) => props.onSection?.(ids),
    ...(Object.fromEntries(ALIGN_ACTIONS.map((id) => [id, alignRun(id)])) as Record<AlignActionId, (ids: string[]) => void>),
    duplicate: (ids) => duplicateTiles(ids),
    'connect-new': () => {
      if (selection.box) {
        connectPickerAt = { x: selection.box.x + selection.box.width + 24, y: selection.box.y };
      }
    },
    'connect-existing': (ids) => {
      targeting = ids;
    },
    'run-workflow': (ids) => props.onRunWorkflow?.(ids),
    'save-technique': (ids) => props.onSaveTechnique?.(ids),
    'run-technique': (ids) => props.onRunTechnique?.(ids),
    'run-technique-rows': (ids) => props.onRunTechniqueRows?.(ids),
    'edit-technique': (ids) => props.onEditTechnique?.(ids),
    'detach-technique': (ids) => props.onDetachTechnique?.(ids),
    'run-downstream': (ids) => props.onRunGraph?.(GraphScope.Downstream, ids),
    'run-stale': (ids) => props.onRunGraph?.(GraphScope.Stale, ids),
    'copy-id': (ids) => void navigator.clipboard?.writeText(ids.join('\n')),
    'copy-link': (ids) => props.onCopyLink?.(ids),
    report: (ids) => void window.open(reportHref({ node: ids[0] }), '_blank', 'noopener'),
    group: (ids) => props.onGroup?.(ids),
    ungroup: (ids) => props.onUngroup?.(ids),
    copy: () => void copySystem(),
    paste: () => menuAt && void pasteSystem(toFlow(menuAt)),
    'bring-front': (ids) => props.onRestack?.(ids, Stack.Front),
    'send-back': (ids) => props.onRestack?.(ids, Stack.Back),
    hide: (ids) => props.onToggleFlag?.(ids, NodeFlag.Hidden),
    lock: (ids) => props.onToggleFlag?.(ids, NodeFlag.Locked),
    'create-formats': (ids) => props.onCreateFormats?.(ids[0]),
    'combine-video': (ids) => props.onCombineScenes?.(ids),
    'remove-background': (ids) => props.onImageTool?.(ids[0], ImageTool.RemoveBackground),
    'upscale-image': (ids) => props.onImageTool?.(ids[0], ImageTool.Upscale),
    inpaint: (ids) => props.onInpaint?.(ids[0]),
    outpaint: (ids) => props.onOutpaint?.(ids[0]),
    reframe: (ids) => props.onReframe?.(ids[0]),
    'split-layers': (ids) => props.onImageTool?.(ids[0], ImageTool.SplitLayers),
    'layers-to-frame': (ids) => props.onLayersToFrame?.(ids[0]),
    export: (ids) => (inside && framePicks().length ? props.onExportElements?.(inside.nodeId, framePicks()) : coreFrames.some((f) => f.id === ids[0]) && ids.length === 1 && frameChrome(kindOfNode(ids[0])).root !== Root.Own ? (frameDialog = { nodeId: ids[0], dialog: FrameDialog.Export }) : props.onExport?.(ids)),
    'frame-history': (ids) => historyPanel.show(ids[0]),
    delete: (ids) => props.onDelete?.(ids)
  };

  function runSelectionAction(id: SelectionActionId) {
    if (selected.length === 1 && isFrameModeAction(id)) {
      editorMode.set(FRAME_MODE_ACTIONS[id]);
      return;
    }
    if (selected.length === 1 && isFrameDialogAction(id)) {
      frameDialog = { nodeId: selected[0], dialog: FRAME_DIALOG_ACTIONS[id] };
      return;
    }
    if (selected.length && isCanvasAction(id)) {
      SELECTION_RUN[id](selected);
    }
  }

  const selectedSummaries = $derived((props.nodeSummaries ?? []).filter((n) => selected.includes(n.id)));
  const selectionEdges = $derived(edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target })));
  const selectionMenuIds = $derived(new Set([...canvasMenuIds()].filter((id) => (id !== 'copy-link' || props.onCopyLink) && enabledFor(id, selectedSummaries, selectionEdges, props.stale ?? []).enabled)));
  const selectionMedium = $derived(
    selectedSummaries.length && selectedSummaries.every((n) => n.type === selectedSummaries[0].type) ? (selectedSummaries[0].type as GenPropertyType) : null
  );
  const pickedKinds = $derived(picked ? edgeKindsFor(lookup, picked.edge.source, picked.edge.target, picked.edge.sourceHandle) : []);

  function addAtCentre(what: Addable) {
    props.onCreate?.(what, viewCentre());
  }

  function pickConnectMedium(medium: GenMedium) {
    if (connectPickerAt) {
      props.onConnectNew?.(selected, medium);
      connectPickerAt = null;
    }
  }

  function pickNextStep(s: { createsNodeType: 'video' | 'text' | 'image' | null; wiring: 'connect-new' | 'create-post'; promptTemplate: string }) {
    if (s.wiring === 'create-post' || !s.createsNodeType) {
      return;
    }
    props.onConnectNew?.(selected, s.createsNodeType, s.promptTemplate);
  }

  const OS_FILES = 'Files';

  function onDragOver(e: DragEvent) {
    const types = e.dataTransfer?.types ?? [];
    if (![CANVAS_DRAG_FILLED_NODE, CANVAS_DRAG_MEDIUM, CANVAS_DRAG_OUTPUT, CANVAS_DRAG_COMPONENT, CANVAS_DRAG_FEED_IMAGE, OS_FILES].some((type) => types.includes(type))) {
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    if (types.includes(CANVAS_DRAG_FEED_IMAGE)) {
      props.onFeedImageOver?.({ x: e.clientX, y: e.clientY });
    }
    componentOver = types.includes(CANVAS_DRAG_COMPONENT) ? framedDrop(toFlow({ x: e.clientX, y: e.clientY })) : null;
  }

  function onDragLeave(e: DragEvent) {
    if (!wrap?.contains(e.relatedTarget as Node | null)) {
      props.onFeedImageOver?.(null);
      componentOver = null;
    }
  }

  let mainPicked = 0;

  $effect(() => {
    const pick = props.pickMain;
    const doc = pick ? liveOf(pick.nodeId)?.doc : null;
    const clip = pick && doc ? mainClipOf(doc, pick.compId) : null;
    if (!pick || !clip || pick.key === mainPicked) {
      return;
    }
    mainPicked = pick.key;
    untrack(() => {
      select([pick.nodeId]);
      goInside(pick.nodeId, Gesture.Click, clip);
      requestAnimationFrame(centreSelection);
    });
  });

  let componentOver = $state<string | null>(null);
  const componentOverBox = $derived(componentOver ? (coreFrames.find((f) => f.id === componentOver)?.box ?? null) : null);

  const dropFrames = () => coreFrames.map((f) => ({ id: f.id, takesDrops: frameChrome(kindOfNode(f.id)).takesDrops }));

  function framedDrop(world: Point, fallbackFrame: string | null = null): string | null {
    const target = componentDropTarget(topNodeAt(world), dropFrames(), fallbackFrame);
    return target.on === ComponentDropOn.Frame ? target.frameId : null;
  }

  async function dropComponent(dragged: ComponentDrag, world: Point, fallbackFrame: string | null = null) {
    componentOver = null;
    const frameId = framedDrop(world, fallbackFrame);
    const frame = frameId ? coreFrames.find((f) => f.id === frameId) : null;
    const saver = frame ? saverOf(frame.id) : null;
    if (!frame || !saver) {
      props.onDropComponent?.(dragged, world);
      return;
    }
    const source = liveOf(dragged.frameId)?.doc ?? (await fetchComponentSource(page.params.projectId ?? '', dragged));
    if (!source) {
      return;
    }
    const offset = { x: (world.x - (frame.box.x + frame.box.w / 2)) / frame.box.w, y: (world.y - (frame.box.y + frame.box.h / 2)) / frame.box.h };
    commit(frame.id, placeInstance(saver.history.present, homed(source, dragged.frameId), dragged.compId, () => crypto.randomUUID().slice(0, 8), offset), 'Inserted a component');
  }

  function onDrop(e: DragEvent) {
    const at = { x: e.clientX, y: e.clientY };
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length && props.onUpload) {
      e.preventDefault();
      files.forEach((file) => props.onUpload?.(file, toFlow(at)));
      return;
    }
    const feedImage = parseFeedImageDrag(e.dataTransfer?.getData(CANVAS_DRAG_FEED_IMAGE) ?? '');
    if (feedImage) {
      e.preventDefault();
      props.onDropFeedImage?.(feedImage, at);
      return;
    }
    const output = e.dataTransfer?.getData(CANVAS_DRAG_OUTPUT);
    if (output) {
      e.preventDefault();
      props.onDropOutput?.(output, at, toFlow(at));
      return;
    }
    const component = parseComponentDrag(e.dataTransfer?.getData(CANVAS_DRAG_COMPONENT) ?? '');
    if (component) {
      e.preventDefault();
      void dropComponent(component, toFlow(at));
      return;
    }
    const filled = parseFilledNodeDrag(e.dataTransfer?.getData(CANVAS_DRAG_FILLED_NODE) ?? '');
    if (filled) {
      e.preventDefault();
      props.onCreateFilled?.(filled, toFlow(at));
      return;
    }
    const what = e.dataTransfer?.getData(CANVAS_DRAG_MEDIUM);
    if (what && isAddable(what)) {
      e.preventDefault();
      props.onCreate?.(what, toFlow(at));
    }
  }

  function retype(kind: CanvasEdgeKind) {
    if (picked) {
      props.onEdgeRetype?.(picked.edge.id, kind);
      picked = null;
    }
  }

  function retypeMode(m: WireMode) {
    if (picked) {
      props.onEdgeModeChange?.(picked.edge.id, m);
      picked = { ...picked, edge: { ...picked.edge, mode: m } };
    }
  }

  onMount(() => {
    const observer = new ResizeObserver(() => {
      measureSurface();
      area = { width: surface!.clientWidth, height: surface!.clientHeight };
    });
    observer.observe(surface!);
    props.onFlow?.(toFlow);
    return () => observer.disconnect();
  });

  function coreOff(why: string) {
    console.warn(`[canvas] core off: ${why}`);
    failed = why;
    coreDrawn = new Set();
  }

  const domTiles = $derived(placed.filter((t) => domIds.has(t.id)));
</script>

<svelte:window onkeydown={onKeydown} onblur={() => (altHeld = false)} onkeyup={(e) => {
  altHeld = e.altKey;
  if (e.key === ' ') {
    space = false;
  }
}} onpointerup={(e) => active && !surface?.contains(e.target as Node) && onUp(e)} onpointermove={(e) => (pointer = { x: e.clientX, y: e.clientY })} oncopy={(e) => onCopy(e, false)} oncut={(e) => onCopy(e, true)} onpaste={onPasteEvent} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap svelte-flow" class:commenting={props.commenting} onfocusin={trackFocus} bind:this={wrap} ondragover={onDragOver} ondragleave={onDragLeave} ondrop={spec.chrome ? onDrop : undefined} data-canvas-surface data-renderer={CORE} data-mode-chrome={editorMode.spec.chrome} data-timeline={timeline?.access ?? TimelineAccess.Hidden} data-revealed={revealed} data-view={`${view.x},${view.y},${view.zoom}`}>
  {#if timeline}
    {@const nodeId = timeline.nodeId}
    <div style="display: contents" role="presentation" onpointerdown={(e) => e.stopPropagation()} onwheel={(e) => e.stopPropagation()}>
      <FrameTimeline
        doc={timeline.doc}
        frame={timeline.frame}
        selection={picks.length > 1 ? picks : inside?.level.clip ? [inside.level.clip] : []}
        mode={frameMode}
        onmode={() => editorMode.toggleMotion()}
        onframe={(f) => scrubTo(nodeId, f)}
        onselect={(ids) => (ids.length > 1 ? pickMany(nodeId, ids) : goInside(nodeId, Gesture.Click, ids[0] ?? null))}
        onaction={(id) => void runFrameAction(id)}
        marks={props.commentMarks?.(nodeId, timeline.doc.fps) ?? []}
        onmark={(id) => props.onMark?.(id)}
        ram={ramNode === nodeId ? ramRuns : []}
        onram={() => cacheRam(nodeId, timeline!.doc)}
        {assetUrl}
        onpin={props.onPinAtPlayhead ? () => props.onPinAtPlayhead?.(nodeId, msOfFrame(timeline?.frame ?? 0, timeline?.doc.fps ?? 1)) : undefined}
        onchange={TIMELINE_CHANGE[timeline.access](nodeId)}
      />
    </div>
  {/if}
  <div
    class="surface svelte-flow__pane"
    bind:this={surface}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onwheel={onWheel}
    onpointerenter={measureSurface}
    onclick={onClickInside}
    ondblclick={onDouble}
    use:pressMenu={openMenuAt}
    onpointerleave={() => {
      props.onPointer?.(null);
      pickHover = null;
    }}
    class:panning={space}
    style:cursor={handleCursor}
    data-owns-pinch
  >
    {#if !failed}
      <svelte:boundary onerror={(e) => coreOff(e instanceof Error ? e.message : String(e))}>
        <CoreFrames bind:this={core} frames={drawnFrames} edited={heldInResize} order={stackOrder} live={coreLive} known={knownSource} cards={nodeCards} posters={posterCards} overlay={coreOverlay} look={coreLook ?? undefined} {view} {area} sourceUrl={coreSource} onready={drawnByCore} onfallback={coreOff} />
      </svelte:boundary>
    {/if}
    <FrameOverlays {view} frames={overlayFrames}>
      {#snippet children(frame)}
        {@const edit = typingMark(frame.id)}
        {#if edit}
          <CoreTextEdit layout={edit.layout} look={edit.look} text={edit.text} typedAhead={edit.typed} runs={edit.runs} lists={edit.lists} styled={edit.styled} base={edit.base} body={edit.body} clipId={edit.clip} oncommit={stopTyping} />
        {/if}
        {#each typing?.nodeId === frame.id || cropping?.nodeId === frame.id ? [] : marksIn(frame.id) as mark (mark.clip)}
          <FrameSelection clip={mark.clip} quad={mark.quad} kind={mark.kind} highlight={mark.highlight} pivot={frameViews.isOn(FrameView.Pivot) && picks.length === 1 ? mark.pivot : null} turn={frame.rotation} ongrab={(grip, handle, e) => grab(frame.id, mark.clip, grip, handle, e)} />
        {/each}
        {@const gradient = gradientMark(frame.id)}
        {#if gradient}
          <GradientHandles rect={gradient.rect} fill={gradient.fill} onchange={(f) => dragGradient(frame.id, gradient.clip, gradient.index, f)} ondone={(f) => dropGradient(frame.id, gradient.clip, gradient.index, f)} />
        {/if}
        {#if isComponentSet(frame.id)}
          <ComponentSetOutline onadd={() => addSetVariantAt(frame.id)} />
        {/if}
        {@const plus = variantMark(frame.id)}
        {#if plus}
          <VariantPlus rect={plus.rect} onadd={() => addVariantAt(frame.id, plus.compId)} />
        {/if}
        {@const crop = cropMark(frame.id)}
        {#if crop}
          <CropHandles rect={crop.rect} fill={crop.fill} src={crop.src} onchange={dragCrop} onapply={() => endCrop(true)} oncancel={() => endCrop(false)} />
        {/if}
        {@const group = typing?.nodeId === frame.id || cropping?.nodeId === frame.id ? null : groupMark(frame.id)}
        {#if group}
          <FrameSelection clip="" quad={group} kind={SelectionKind.Group} turn={frame.rotation} ongrab={(grip, handle, e) => grab(frame.id, null, grip, handle, e)} />
        {/if}
        {@const guideArea = inside?.nodeId === frame.id ? frameArea(frame.id) : null}
        {@const measuredGapsIn = measuredIn(frame.id)}
        {#if guideArea && ((frameGuides?.nodeId === frame.id && (frameGuides.guides.length || frameGuides.gaps.length || frameGuides.drop)) || measuredGapsIn.length)}
          <FrameGuides area={guideArea.rect} size={guideArea.size} guides={frameGuides?.nodeId === frame.id ? frameGuides.guides : []} gaps={frameGuides?.nodeId === frame.id ? frameGuides.gaps : []} drop={frameGuides?.nodeId === frame.id ? (frameGuides.drop ?? null) : null} measured={measuredGapsIn} />
        {/if}
        {#if pickHover?.at === frame.id}
          <div class="pick-outline" data-testid="frame-pick-box" data-hovered={pickHover.clip} style={highlightStyle(pickHover.highlight) + ';' + quadStyle(pickHover.quad.map((p) => [(p.x - frame.x) * view.zoom, (p.y - frame.y) * view.zoom] as const))}></div>
        {/if}
        {@const live = peering ? liveOf(frame.id) : null}
        {@const peers = peering ? peering.peersOf(frame.id, onCanvas) : []}
        {#if peering && live && (peers.length || pointedFrame === frame.id)}
          <FramePeers doc={live.doc} frame={frameOfLive(live)} redraws={0} {peers} measure={() => peerMeasure(frame.id, peers.flatMap((p) => p.selection))} onpointer={(cursor) => pointedFrame === frame.id && peering.point(frame.id, cursor, picks)} />
        {/if}
        {@const tools = toolsOf(frame.id)}
        {#if tools}
          <FrameTools doc={tools.doc} frame={tools.frame} mode={frameMode} views={frameViews.all} boxes={outlineBoxes(frame.id, tools.doc)} size={{ width: frame.w * view.zoom, height: frame.h * view.zoom }} {picks} tool={frameBar.tool} apply={(result, summary) => commit(frame.id, result, summary)} ondrawn={(id) => drawnInside(frame.id, id)} onleave={leaveBuilder} />
        {/if}
        {@const band = marqueeRect(frame.id)}
        {#if band}
          <div class="frame-marquee" data-testid="frame-marquee" style={`left:${band.left}px;top:${band.top}px;width:${band.width}px;height:${band.height}px`}></div>
        {/if}
      {/snippet}
    </FrameOverlays>
    <FrameOverlays {view} frames={viewOverlays}>
      {#snippet children(frame)}
        {@const nodeId = baseNodeId(frame.id)}
        {#each typing || cropping?.nodeId === nodeId ? [] : marksIn(frame.id) as mark (mark.clip)}
          <FrameSelection clip={mark.clip} quad={mark.quad} kind={mark.kind} highlight={mark.highlight} pivot={null} turn={0} ongrab={(grip, handle, e) => grab(nodeId, mark.clip, grip, handle, e)} />
        {/each}
        {#if pickHover?.at === frame.id}
          <div class="pick-outline" data-testid="view-pick-box" data-hovered={pickHover.clip} style={highlightStyle(pickHover.highlight) + ';' + quadStyle(pickHover.quad.map((p) => [(p.x - frame.x) * view.zoom, (p.y - frame.y) * view.zoom] as const))}></div>
        {/if}
        {@const viewLive = inside?.nodeId === nodeId ? viewLives.get(frame.id) : null}
        {#if viewLive}
          <FrameTools doc={viewLive.doc} frame={frameOfLive(viewLive)} views={contentViews(frameViews.all)} boxes={outlineBoxes(frame.id, viewLive.doc)} size={{ width: frame.w * view.zoom, height: frame.h * view.zoom }} picks={[]} tool={DrawTool.Select} apply={() => {}} ondrawn={() => {}} onleave={() => {}} />
        {/if}
      {/snippet}
    </FrameOverlays>
    {#if manyQuad}
      <FrameSelection clip="" quad={manyQuad} kind={SelectionKind.Many} ongrab={grabMany} />
    {/if}
    <PrototypePlayerHost frames={playerFrames} />
    {#if showsPrototype}
      <PrototypeArrows {view} frames={overlayFrames} links={arrowLinks} elements={linkElements()} handle={pickedHandle()} aimingFrom={prototypeLink.draft ? (inside?.nodeId ?? null) : null} onpick={openLink} ondrag={dragLink} />
    {/if}
    <div class="svelte-flow__viewport gpu-nodes" style={`transform: translate(${view.x}px, ${view.y}px) scale(${view.zoom});--zoom:${view.zoom}`}>
      <svg class="gpu-edges core" aria-hidden="true">
        {#each curves as c (c.edge.id)}
          <g class="svelte-flow__edge" class:selected={c.edge.id === selectedEdge} class:iterate={(c.edge.mode ?? 'fixed') === 'iterate'} class:linked={selected.includes(c.edge.source) || selected.includes(c.edge.target)} data-id={c.edge.id} data-source={c.edge.source} data-target={c.edge.target}>
            <path class="svelte-flow__edge-path" d={`M${c.curve.from.x},${c.curve.from.y} C${c.curve.c1.x},${c.curve.c1.y} ${c.curve.c2.x},${c.curve.c2.y} ${c.curve.to.x},${c.curve.to.y}`} />
            {#if (c.edge.mode ?? 'fixed') === 'iterate'}
              <g class="wire-iterate-badge" data-testid="wire-iterate-icon" transform={`translate(${c.curve.mid.x} ${c.curve.mid.y})`}>
                <circle r="11" />
                <Repeat x={-7} y={-7} width={14} height={14} />
              </g>
            {/if}
          </g>
        {/each}
      </svg>
      {#each [...copies] as [id, c] (id)}
        <div class="gpu-copy-ghost" data-testid="gpu-copy-ghost" style={`transform: translate(${c.x}px, ${c.y}px);width:${c.w}px;height:${c.h}px`}></div>
      {/each}
      {#each placed as t (t.id)}
        {@const on = selected.includes(t.id)}
        <div
          class="svelte-flow__node gpu-node"
          class:selected={on}
          class:has-dom={domIds.has(t.id)}
          role="button"
          tabindex="-1"
          aria-label={t.displayName || t.kind || 'node'}
          aria-pressed={on}
          data-testid="gpu-node"
          data-id={t.id}
          data-kind={t.kind}
          data-core={coreDrawn.has(t.id) || undefined}
          data-box={`${t.x},${t.y},${t.w},${t.h}`}
          style={`transform: translate(${t.x}px, ${t.y}px);width:${t.w}px;height:${t.h}px;--bar-h:${holdsDoc(t.kind ?? '') && frameChrome(kindOfNode(t.id)).bar ? MOTION_NODE_BAR_H : 0}px${t.rotation ? `;rotate:${t.rotation}deg;transform-origin:${t.w / 2}px ${t.h / 2}px` : ''}`}
        >
          <GpuTileChrome tile={t} selected={on} painted={coreDrawn.has(t.id)} full={chromeIds.has(t.id)} resizable={resizable && on} onaddbeside={addsBeside(t) && props.onAddBeside ? (id) => seed(props.onAddBeside?.(id)) : undefined} showAdd={on || hovered === t.id || addLinger === t.id} />
          {#if !domIds.has(t.id) && holdsDoc(t.kind ?? '')}
            {@const kind = kindOfNode(t.id)}
            <div class="frame-standin" data-testid="motion-node" data-motion-node={t.id} data-kind={kind} data-mode="gpu" style={`--bar-h:${kind === 'frame' ? MOTION_NODE_BAR_H : 0}px`}>
              <div class="frame-standin-stage" data-testid="motion-node-stage" data-frame-stage data-drawn={coreDrawn.has(t.id)}>
                {#if t.poster}
                  <div class="frame-standin-poster" data-testid="motion-node-poster"></div>
                {/if}
              </div>
            </div>
          {/if}
          {@render props.tileOver?.({ id: t.id, body: domIds.has(t.id) ? TileBody.Dom : TileBody.Standin })}
          {#if domIds.has(t.id)}
            <div class="gpu-dom-node" class:unshown={!handedOver(t)} data-testid="gpu-dom-node" data-id={t.id}>
              <NodeBoundary>
                {@render props.tile({ id: t.id, selected: on })}
              </NodeBoundary>
            </div>
          {/if}
        </div>
      {/each}
      {@render props.canvasOver?.()}
      <PeerLayer peers={corePeers.length ? (props.peers ?? []).filter((p) => p.chat) : (props.peers ?? [])} outlined={!corePeers.length} rectOf={(id) => byId.get(id) ?? null} zoom={view.zoom} />
      {#if measured.length || snapGuides.length || snapSpacing.length}
        <MeasureLayer gaps={[...measured, ...snapSpacing]} guides={[]} zoom={view.zoom} />
      {/if}
    </div>
  </div>


  {#if failed}
    <p class="edge-refusal" role="alert">GPU renderer unavailable: {failed}</p>
  {/if}

  <PageZoomLock zoom={pageZoom} />

  {#if naming && namingBox}
    <input
      class="name-input"
      data-testid="node-name-input"
      aria-label="Node name"
      style={`left:${namingBox.left}px;top:${namingBox.top}px;width:${namingBox.width}px;height:${NAME_HEIGHT}px`}
      bind:value={naming.value}
      {@attach (el) => (el.focus(), el.select())}
      onkeydown={onNamingKey}
      onblur={() => endNaming(true)}
    />
  {/if}


  {#if refusal}
    <p class="edge-refusal" role="status">{refusal}</p>
  {/if}

  {#if targeting}
    <p class="edge-refusal" role="status">Pick the node to connect to — Esc to cancel</p>
  {/if}

  {#if props.onDraw && frameBar.tool !== DrawTool.Select && frameBar.tool !== DrawTool.ShapeBuilder}
    <CanvasDrawLayer
      tool={frameBar.tool}
      {toFlow}
      ondraw={drawOnCanvas}
      onframe={(target) => {
        seed(props.onDrawFrame?.(target));
        frameBar.tool = DrawTool.Select;
      }}
    />
  {/if}

  {#if spec.chrome && props.onCreate}
    <CanvasAddBar
      onpick={addAtCentre}
      models={hotTiles((medium) => props.modelChoicesFor?.(medium) ?? [])}
      onmodel={(model) => props.onCreateFilled?.(hotDrag(model), viewCentre())}
      onupload={props.onUpload ? (file) => props.onUpload?.(file, viewCentre()) : undefined}
      oncloud={props.onCloud && !isOff(LocalOff.CloudImport) ? () => props.onCloud?.('google_drive', CloudMode.Import, null, viewCentre()) : undefined}
      ontemplate={props.onTemplate ? (id) => props.onTemplate?.(id, viewCentre()) : undefined}
      techniques={props.techniques}
      ontechnique={props.onTechnique ? (id) => props.onTechnique?.(id, viewCentre()) : undefined}
      onframes={props.onFrameTemplates ? () => props.onFrameTemplates?.(viewCentre()) : undefined}
      onfigma={props.onFigmaImport ? () => props.onFigmaImport?.(viewCentre()) : undefined}
      onurl={props.onUrlImport ? () => props.onUrlImport?.(viewCentre()) : undefined}
      oncode={props.onCodeImport ? () => props.onCodeImport?.(viewCentre()) : undefined}
      ontrailer={panelNodeId ? startTrailer : undefined}
      onimage={insertImageInFrame}
      oncomment={props.onCommenting ? () => props.onCommenting?.(!props.commenting) : undefined}
      commenting={props.commenting}
      onframelibrary={soleFrame ? () => (frameDialog = { nodeId: soleFrame, dialog: FrameDialog.Templates }) : undefined}
      context={barContextFor(soleFrame)}
    />
  {/if}

  {#if componentOverBox}
    <div class="component-drop" data-testid="component-drop-target" style={`left:${componentOverBox.x * view.zoom + view.x}px;top:${componentOverBox.y * view.zoom + view.y}px;width:${componentOverBox.w * view.zoom}px;height:${componentOverBox.h * view.zoom}px`}></div>
  {/if}

  {#if spec.chrome}
    <SelectionToolbar
      box={gesturing ? null : selection.box}
      zoom={selection.zoom}
      count={selected.length}
      nodeSummaries={selectedSummaries}
      edges={selectionEdges}
      stale={props.stale ?? []}
      choicesFor={props.modelChoicesFor}
      catalogueSynced={selectionMedium && props.catalogueSyncedFor ? props.catalogueSyncedFor(selectionMedium) : true}
      runQuote={props.runQuoteFor?.(selected) ?? null}
      onrun={() => props.onRunNode?.(selected[0])}
      variantsInFlight={selected.length === 1 ? (props.variantsInFlightFor?.(selected[0]) ?? 0) : 0}
      oncancelvariants={() => props.onCancelVariants?.(selected[0])}
      history={selected.length === 1 ? (props.historyFor?.(selected[0]) ?? null) : null}
      onstop={() => props.onCancelRun?.(selected[0])}
      onaction={runSelectionAction}
      onpropertychange={(patch) => props.onPropertyChange?.(selected, patch)}
      onsectionchange={(id, patch) => props.onSectionChange?.(id, patch)}
      oncolourchange={(tag) => props.onColourChange?.(selected, tag)}
      onview={() => props.onViewOutput?.(selected[0])}
      oncompare={() => props.onCompareOutputs?.(selected)}
      onexportcloud={(provider) => props.onCloud?.(provider, CloudMode.Export, selected[0], viewCentre())}
    />
    {#if props.postAction && !isOff(LocalOff.NextSteps)}
      <NextStepChips postAction={props.postAction} box={selection.box} zoom={selection.zoom} nodeId={selected.length === 1 ? selected[0] : null} onpick={pickNextStep} />
    {/if}
  {/if}

  {#if remixOf && spec.chrome}
    <div class="remix-banner">
      <RemixBanner origin={remixOf} onbrand={brandRemix} />
    </div>
  {/if}

  {#if frameDialog && dialogSession && dialogExtras && dialogTokens}
    {@const nodeId = frameDialog.nodeId}
    <FrameDialogs
      dialog={frameDialog.dialog}
      {nodeId}
      box={byId.get(nodeId) ?? null}
      projectId={page.params.projectId ?? ''}
      canvasId={page.params.canvasId ?? ''}
      session={dialogSession}
      extras={dialogExtras}
      tokens={dialogTokens}
      frame={frameOfLive(liveOf(nodeId)!)}
      onedit={(result, summary) => commit(nodeId, result, summary)}
      onswitch={(next) => (frameDialog = { nodeId, dialog: next })}
      onimages={(rows) => props.onExportRows?.([nodeId], rows) ?? Promise.resolve('Export failed')}
      onpreview={(doc) => showDialogDoc(nodeId, doc)}
      onclose={() => closeDialog(nodeId)}
    />
  {/if}

  {#if elementMenu && inside && spec.chrome}
    {@const doc = liveOf(inside.nodeId)?.doc}
    {#if doc}<CanvasContextMenu at={elementMenu} summaries={frameSummaries(doc, picks)} available={elementMenuIds(doc, picks)} layers={elementLayers} onlayer={(id) => inside && pickMany(inside.nodeId, [id])} onpick={runElementMenu} onclose={() => (elementMenu = null)} />{/if}
  {/if}

  {#if spec.chrome}
    <CommandPalette onrun={runPaletteCommand} />
  {/if}

  {#if menuAt && spec.chrome}
    <CanvasContextMenu at={menuAt} summaries={selectedSummaries} available={selectionMenuIds} layers={menuLayers} onpick={runSelectionAction} onlayer={(id) => select([id])} onclose={() => (menuAt = null)} />
  {/if}

  {#if connectPickerAt}
    <ConnectPicker at={connectPickerAt} onpick={pickConnectMedium} onclose={() => (connectPickerAt = null)} />
  {/if}

  {#if picked && (props.onEdgeRetype || props.onEdgeDelete || props.onEdgeModeChange)}
    <EdgePanel
      edge={picked.edge}
      at={picked.screen}
      kinds={props.onEdgeRetype ? pickedKinds : []}
      modes={!!props.onEdgeModeChange}
      deletable={!!props.onEdgeDelete}
      onkind={retype}
      onmode={retypeMode}
      ondelete={() => {
        if (picked) {
          props.onEdgeDelete?.(picked.edge.id);
        }
        picked = null;
      }}
      onclose={() => (picked = null)}
    />
  {/if}
</div>

<style>

  .wrap.commenting .surface {
    cursor: crosshair;
  }

  .frame-marquee {
    position: absolute;
    border: 1px solid var(--ui-accent, #3b82f6);
    background: color-mix(in srgb, var(--ui-accent, #3b82f6) 12%, transparent);
  }

  :global(html.canvas-gesture),
  :global(html.canvas-gesture *) {
    user-select: none !important;
    -webkit-user-select: none !important;
  }

  .wrap[data-renderer='core'] :global(.gpu-dom-node [data-testid='motion-preview']) {
    background: transparent;
  }

  .wrap[data-renderer='core'] :global(.gpu-dom-node [data-testid='motion-preview'] > .host),
  .wrap[data-renderer='core'] :global(.gpu-dom-node [data-testid='motion-preview'] > .gpu-wrap) {
    visibility: hidden;
  }

  .wrap[data-renderer='core'] :global(.gpu-dom-node [data-testid='motion-preview'] > .host [contenteditable='true']),
  .wrap[data-renderer='core'] :global(.gpu-dom-node [data-testid='motion-preview'] > .host [contenteditable='true'] *) {
    visibility: visible;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important;
    background: transparent !important;
    caret-color: #0a84ff;
  }

  .wrap:not([data-revealed='true']) .surface,
  .wrap:not([data-revealed='true']) :global(canvas[data-testid='gpu-canvas']) {
    visibility: hidden;
  }

  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: clip;
    background: var(--ui-canvas);
  }

  .wrap[data-mode-chrome='recording']::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid var(--ui-recording);
    pointer-events: none;
    z-index: 40;
  }

  .surface {
    position: absolute;
    inset: 0;
    touch-action: none;
    overscroll-behavior: none;
    user-select: none;
  }

  .surface.panning {
    cursor: grab;
  }

  .surface :global(canvas[data-testid='gpu-canvas']) {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .gpu-nodes {
    position: absolute;
    z-index: 1;
    left: 0;
    top: 0;
  }

  .pick-outline {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid var(--highlight, var(--ui-highlight));
    pointer-events: none;
    transform-origin: 0 0;
  }

  .gpu-node {
    left: 0;
    top: 0;
  }

  .gpu-copy-ghost {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    border: 1.5px dashed var(--ui-accent, #0a84ff);
    background: color-mix(in srgb, var(--ui-accent, #0a84ff) 8%, transparent);
  }

  .gpu-node :global(.svelte-flow__handle.typed-port) {
    pointer-events: all;
    cursor: crosshair;
  }

  .gpu-edges {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
  }

  .gpu-edges path {
    fill: none;
    stroke: color-mix(in srgb, var(--ink-soft, #6e6e73) 45%, var(--paper, #fff));
    stroke-width: 1;
  }

  .gpu-edges .linked path,
  .gpu-edges .selected path {
    stroke: var(--ink-soft, #6e6e73);
  }

  .gpu-edges .iterate path {
    stroke: var(--ui-wire-iterate);
    stroke-dasharray: 6 4;
  }

  .gpu-edges.core {
    visibility: hidden;
  }

  .wire-iterate-badge circle {
    fill: var(--ui-panel-raised);
    stroke: var(--ui-wire-iterate);
    stroke-width: 1.5;
  }

  .wire-iterate-badge :global(svg) {
    color: var(--ui-wire-iterate);
  }

  .frame-standin {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node.unshown :global([data-motion-node]) {
    opacity: 0;
  }

  .frame-standin-stage {
    position: absolute;
    inset: 0 0 var(--bar-h) 0;
  }

  .frame-standin-poster {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node {
    position: absolute;
    inset: 0;
    content-visibility: auto;
    user-select: text;
  }

  .frame-standin {
    position: absolute;
    inset: 0;
  }

  .frame-standin-stage {
    position: absolute;
    inset: 0 0 var(--bar-h) 0;
  }

  .frame-standin-poster {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node {
    position: absolute;
    inset: 0;
    content-visibility: auto;
    user-select: text;
  }


  .remix-banner {
    position: absolute;
    top: var(--chrome-top, 12px);
    left: 50%;
    translate: -50% 0;
    max-width: calc(100% - 32px);
    z-index: 5;
  }

  .name-input {
    position: fixed;
    z-index: 30;
    padding: 0 6px;
    border: 1px solid var(--ui-accent, #0a84ff);
    border-radius: var(--ui-radius-sm);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    font: inherit;
    font-size: 12px;
    outline: none;
  }

  .edge-refusal {
    position: absolute;
    z-index: 12;
    top: var(--chrome-top, 12px);
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 999px;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.1);
    pointer-events: none;
  }

  .component-drop {
    position: absolute;
    pointer-events: none;
    box-shadow: 0 0 0 2px #9747ff;
    background: color-mix(in srgb, #9747ff 8%, transparent);
  }
</style>
