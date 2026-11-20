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
