import { OpKind, type DocOp } from '$lib/motion/doc-ops';

export enum CoreEvent {
  CanvasOpened = 'canvas_opened',
  UrlImported = 'url_imported',
  FigmaPasted = 'figma_pasted',
  TemplateInserted = 'template_inserted',
  FrameCreated = 'frame_created',
  FrameEdited = 'frame_edited',
  MotionEdited = 'motion_edited',
  NodeGenerated = 'node_generated',
  ExportCompleted = 'export_completed',
  AgentAction = 'agent_action'
}

export enum ActorKind {
  User = 'user',
  Agent = 'agent',
  System = 'system'
}

export enum FigmaSource {
  Paste = 'paste',
  Link = 'link'
}

export enum TemplateKind {
  Canvas = 'canvas',
  Frame = 'frame'
}

export enum MotionEditKind {
  Keyframe = 'keyframe',
  Timeline = 'timeline',
  Prompt = 'prompt',
  Component = 'component'
}

export enum GeneratedMedium {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Model3d = '3d',
  Text = 'text'
}

export enum ExportKind {
  Video = 'video',
  Code = 'code',
  Image = 'image'
}

export enum AgentVia {
  Mcp = 'mcp',
  Cli = 'cli',
  Chat = 'chat'
}

export type CoreProps = {
  [CoreEvent.CanvasOpened]: { canvas_id: string };
  [CoreEvent.UrlImported]: { canvas_id: string };
  [CoreEvent.FigmaPasted]: { source: FigmaSource };
  [CoreEvent.TemplateInserted]: { kind: TemplateKind; template_id: string };
  [CoreEvent.FrameCreated]: { frame_id: string; actor: ActorKind };
  [CoreEvent.FrameEdited]: { frame_id: string; actor: ActorKind };
  [CoreEvent.MotionEdited]: { frame_id: string; kind: MotionEditKind };
  [CoreEvent.NodeGenerated]: { medium: GeneratedMedium };
  [CoreEvent.ExportCompleted]: { format: ExportKind; target: string };
  [CoreEvent.AgentAction]: { via: AgentVia; op: string };
};

export const ONCE_PER_FRAME: Partial<Record<CoreEvent, (props: Record<string, unknown>) => string>> = {
  [CoreEvent.FrameEdited]: (p) => String(p.frame_id),
  [CoreEvent.MotionEdited]: (p) => `${p.frame_id}:${p.kind}`
};

const FAILED_OUTCOMES = new Set(['conflict', 'invalid', 'refused', 'gone']);

export function landed(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return true;
  }

  const answer = body as { error?: unknown; outcome?: unknown };
  return answer.error === undefined && !FAILED_OUTCOMES.has(String(answer.outcome));
}

export const LOCAL_MODE_EVENTS: ReadonlySet<CoreEvent> = new Set([CoreEvent.FrameCreated, CoreEvent.ExportCompleted]);

const TIMELINE_FIELDS = new Set(['from', 'durationInFrames']);
const COMPONENT_FIELDS = new Set(['comps', 'components']);
const TIMELINE = () => MotionEditKind.Timeline;

const EDIT_OF_OP: Partial<{ [K in OpKind]: (op: Extract<DocOp, { kind: K }>) => MotionEditKind | null }> = {
  [OpKind.ClipEntry]: (op) => (op.field === 'keyframes' ? MotionEditKind.Keyframe : null),
  [OpKind.ClipSet]: (op) => (TIMELINE_FIELDS.has(op.field) ? MotionEditKind.Timeline : op.field === 'component' ? MotionEditKind.Component : null),
  [OpKind.DocEntry]: (op) => (COMPONENT_FIELDS.has(op.field) ? MotionEditKind.Component : null),
  [OpKind.ClipAdd]: TIMELINE,
  [OpKind.ClipMove]: TIMELINE,
  [OpKind.ClipRemove]: TIMELINE,
  [OpKind.TrackAdd]: TIMELINE,
  [OpKind.TrackMove]: TIMELINE,
  [OpKind.TrackRemove]: TIMELINE
};

export function motionEdits(ops: readonly DocOp[]): MotionEditKind[] {
  const kinds = ops.map((op) => (EDIT_OF_OP[op.kind] as ((op: DocOp) => MotionEditKind | null) | undefined)?.(op) ?? null);
  return [...new Set(kinds.filter((k) => k !== null))];
}
