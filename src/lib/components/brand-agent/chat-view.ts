export type ToolStatus = 'running' | 'done' | 'error';

export type ToolCall = {
  toolCallId?: string;
  toolName: string;
  status?: ToolStatus;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export const TOOL_STATUS: Record<ToolStatus, { labelKey: string; tone: 'muted' | 'ok' | 'danger' }> = {
  running: { labelKey: 'chat.panel.tool.running', tone: 'muted' },
  done: { labelKey: 'chat.panel.tool.done', tone: 'ok' },
  error: { labelKey: 'chat.panel.tool.error', tone: 'danger' }
};

const REFUSED_OUTCOMES = new Set(['conflict', 'refused']);

type Output = { error?: unknown; outcome?: unknown; node?: NodeRef; connection?: { canvasId?: string } };
type NodeRef = { canvasId?: string; type?: string; displayName?: string | null };

function outputOf(call: ToolCall): Output | null {
  const out = call.output;
  return out && typeof out === 'object' ? (out as Output) : null;
}

function refused(out: Output | null): boolean {
  return !!out && (!!out.error || REFUSED_OUTCOMES.has(String(out.outcome)));
}

export function toolStatusOf(call: ToolCall): ToolStatus {
  if (call.status === 'error' || refused(outputOf(call))) {
    return 'error';
  }
  return call.status ?? 'running';
}

export type CanvasLink = { href: string; label: string };

const CANVAS_TARGETS: Record<string, (out: Output) => { canvasId?: string; label: string } | null> = {
  create_node: nodeTarget,
  update_node: nodeTarget,
  move_node: nodeTarget,
  connect_nodes: (out) => (out.connection ? { canvasId: out.connection.canvasId, label: 'connection' } : null)
};

function nodeTarget(out: Output) {
  if (!out.node) {
    return null;
  }
  return { canvasId: out.node.canvasId, label: out.node.displayName || out.node.type || 'node' };
}

export function canvasLinkOf(call: ToolCall, projectId: string): CanvasLink | null {
  const out = outputOf(call);
  const target = out && !refused(out) ? CANVAS_TARGETS[call.toolName]?.(out) : null;
  if (!target?.canvasId || !projectId) {
    return null;
  }
  return { href: `/p/${projectId}/c/${target.canvasId}`, label: target.label };
}

export type Failure = 'load' | 'send' | 'empty' | 'credits' | 'blocked';

const HTTP_PAYMENT_REQUIRED = 402;

export const FAILURES: Record<Failure, { messageKey: string; action: 'retry' | 'credits' | 'rephrase' }> = {
  load: { messageKey: 'chat.panel.failure.load', action: 'retry' },
  send: { messageKey: 'chat.panel.failure.send', action: 'retry' },
  empty: { messageKey: 'chat.panel.failure.empty', action: 'retry' },
  credits: { messageKey: 'chat.panel.failure.credits', action: 'credits' },
  blocked: { messageKey: 'chat.panel.failure.blocked', action: 'rephrase' }
};

const FAILURE_OF_CODE: Readonly<Record<string, Failure>> = {
  prompt_blocked: 'blocked'
};

export function failureOfStatus(status: number, code?: string): Failure {
  const coded = code ? FAILURE_OF_CODE[code] : undefined;
  return coded ?? (status === HTTP_PAYMENT_REQUIRED ? 'credits' : 'send');
}

export function speakerStarts(messages: Array<{ role: string }>): boolean[] {
  return messages.map((m, i) => i === 0 || messages[i - 1].role !== m.role);
}

export function keyboardInset(v: {
  innerHeight: number;
  viewportHeight: number;
  offsetTop: number;
  reservedBelow: number;
}): number {
  const covered = v.innerHeight - v.viewportHeight - v.offsetTop;
  return Math.max(0, Math.round(covered - v.reservedBelow));
}

const VIEWED_PATH = /\/web-views\/([\w-]+)\/([\w-]+\.jpg)$/;
const VIEWING_TOOLS = new Set(['view_images', 'view_video_frames']);

export type ViewedPicture = { href: string; source: string };

export function viewedPicturesOf(call: ToolCall, projectId: string, canvasId: string): ViewedPicture[] {
  const images = (call.output as { images?: { url?: unknown; path?: unknown }[] } | null)?.images;
  if (!VIEWING_TOOLS.has(call.toolName) || !canvasId || !Array.isArray(images)) {
    return [];
  }
  return images.flatMap((image) => {
    const href = typeof image.path === 'string' ? viewedHref(image.path, projectId, canvasId) : null;
    return href ? [{ href, source: String(image.url ?? '') }] : [];
  });
}

export function viewedHref(path: string, projectId: string, canvasId: string): string | null {
  const match = path.match(VIEWED_PATH);
  return match ? `/p/${projectId}/c/${canvasId}/web-views/${match[1]}/${match[2]}` : null;
}

