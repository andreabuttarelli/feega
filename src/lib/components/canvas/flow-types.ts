import type { ActionResult } from '@sveltejs/kit';
import type { Snippet } from 'svelte';
import type { Offset } from '$lib/canvas/duplicate-plan';
import type { FocusRequest } from '$lib/canvas/free-area';
import type { GenPropertyType } from '$lib/canvas/common-properties';
import type { ColourTag } from '$lib/canvas/node-colour';
import type { Poster } from '$lib/canvas/poster-lod';
import type { CanvasPeer, LiveBox, View } from '$lib/realtime/canvas-presence';
import type { BarContext } from '$lib/canvas/bottom-bar';
import type { NameTag } from '$lib/canvas/node-label';
import type { CanvasBox, DrawnWire } from '$lib/motion/draw-create';
import type { GenMedium, ModelChoice } from '$lib/canvas/gen-node';
import type { FilledNodeDrag } from '$lib/canvas/drag-payload';
import type { SelectOutput } from '$lib/canvas/select-outputs';
import type { CanvasEdgeKind, FlowEdge, WireMode } from '$lib/canvas-edges';
import type { Addable } from '$lib/canvas/addable';
import type { ConnectorType } from '$lib/canvas/connectors';
import type { CanvasNode } from '$lib/canvas/graph';
import type { CanvasMode } from '$lib/canvas/canvas-mode';
import type { RunQuote } from '$lib/canvas/run-quote';
import type { GraphScope } from '$lib/canvas/run-graph';
import type { ImageTool } from '$lib/image-tools';
import type { DragPhase, DropVerdict, ElementOut, PointerPoint } from '$lib/canvas/canvas-drop';
import type { Stack } from '$lib/canvas/stacking';
import type { DeleteMode } from '$lib/canvas/section';
import type { SceneDrop } from '$lib/canvas/scene-drop';

export type Tile = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  connectable?: boolean;
  tag?: NameTag;
  rotation?: number;
  rotatable?: boolean;
  members?: string[];
  behind?: boolean;
  node?: CanvasNode;
  minW?: number;
  minH?: number;
  connectors?: ConnectorType[];
  output?: ConnectorType | null;
  outputs?: SelectOutput[];
  kind?: string;
  displayName?: string | null;
  inPost?: boolean;
  select?: boolean;
  settings?: boolean;
  poster?: Poster;
};

export type FlowProps = {
  postAction?: (action: string, form: FormData) => Promise<ActionResult>;
  tiles?: Tile[];
  edges?: FlowEdge[];
  onMove?: (id: string, x: number, y: number) => void;
  onMoveEnd?: (moves: { id: string; x: number; y: number }[]) => void;
  onTileDragOver?: (ids: string[], at: PointerPoint) => void;
  onTileDrop?: (ids: string[], at: PointerPoint) => DropVerdict;
  onElementOut?: (frameId: string, out: ElementOut, phase: DragPhase) => void;
  onConnect?: (
    sourceItemId: string,
    targetItemId: string,
    kind: CanvasEdgeKind,
    targetHandle: ConnectorType | null,
    sourceHandle: string | null,
  ) => void;
  onDelete?: (ids: string[], mode?: DeleteMode) => void;
  onSection?: (ids: string[]) => void;
  onColourChange?: (ids: string[], tag: ColourTag | null) => void;
  onSectionChange?: (id: string, patch: { title?: string; fill?: string }) => void;
  onCreateFormats?: (frameId: string) => void;
  onCombineScenes?: (frameIds: string[]) => void;
  onInsertScene?: (drop: SceneDrop) => void;
  onImageTool?: (nodeId: string, tool: ImageTool) => void;
  onLayersToFrame?: (nodeId: string) => void;
  onExport?: (frameIds: string[]) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onEdgeRetype?: (edgeId: string, kind: CanvasEdgeKind) => void;
  onEdgeModeChange?: (edgeId: string, mode: WireMode) => void;
  onCreate?: (what: Addable, at: { x: number; y: number }) => void;
  onCreateFilled?: (drag: FilledNodeDrag, at: { x: number; y: number }) => void;
  onDropOutput?: (
    nodeId: string,
    client: PointerPoint,
    at: { x: number; y: number },
  ) => void;
  onFlow?: (
    toFlow: (p: { x: number; y: number }) => { x: number; y: number },
  ) => void;
  onUpload?: (file: File, at?: { x: number; y: number }) => void;
  onDuplicate?: (ids: string[], offset?: Offset) => void;
  onCopy?: (ids: string[]) => void;
  onPaste?: (at: { x: number; y: number }) => void;
  onTemplate?: (id: string, at: { x: number; y: number }) => void;
  onFrameTemplates?: (at: { x: number; y: number }) => void;
  onNodeClicked?: (id: string) => void;
  onNodeDoubled?: (id: string) => void;
  barContext?: BarContext;
  onDraw?: (drawn: DrawnWire) => Promise<string>;
  onDrawFrame?: (
    target: { box: CanvasBox } | { at: { x: number; y: number } },
  ) => Promise<void>;
  onRotate?: (id: string, degrees: number) => void;
  onAddBeside?: (id: string) => void;
  onGroup?: (ids: string[]) => void;
  onUngroup?: (ids: string[]) => void;
  onRestack?: (ids: string[], to: Stack) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onConnectNew?: (ids: string[], medium: GenMedium, prompt?: string) => void;
  focus?: FocusRequest | null;
  onConnectExisting?: (ids: string[], targetId: string) => void;
  onRunWorkflow?: (ids: string[]) => void;
  onRunGraph?: (graph: GraphScope, ids: string[]) => void;
  stale?: string[];
  runQuoteFor?: (ids: string[]) => RunQuote | null;
  onRunNode?: (id: string) => void;
  onViewOutput?: (id: string) => void;
  nodeSummaries?: { id: string; type: string; data: Record<string, unknown> }[];
  modelChoicesFor?: (type: GenPropertyType) => ModelChoice[];
  catalogueSyncedFor?: (type: GenPropertyType) => boolean;
  onSelectionChange?: (ids: string[]) => void;
  onPropertyChange?: (
    ids: string[],
    patch: {
      model?: string | null;
      aspectRatio?: string;
      duration?: number;
      resolution?: string;
      audio?: boolean;
      enhancePrompt?: boolean;
      repeat?: number;
      dynamicParams?: Record<string, unknown>;
    },
  ) => void;
  onResize?: (id: string, w: number, h: number) => void;
  onPlace?: (id: string, w: number, h: number) => void;
  peers?: CanvasPeer[];
  onPointer?: (at: { x: number; y: number } | null) => void;
  onLive?: (boxes: LiveBox[]) => void;
  onView?: (view: View) => void;
  onUserPan?: () => void;
  follow?: View | null;
  tile: Snippet<[{ id: string; selected: boolean }]>;
  mode?: CanvasMode;
};
