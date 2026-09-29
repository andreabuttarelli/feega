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

export type Failure = 'load' | 'send' | 'empty' | 'credits';

const HTTP_PAYMENT_REQUIRED = 402;

export const FAILURES: Record<Failure, { messageKey: string; action: 'retry' | 'credits' }> = {
  load: { messageKey: 'chat.panel.failure.load', action: 'retry' },
  send: { messageKey: 'chat.panel.failure.send', action: 'retry' },
  empty: { messageKey: 'chat.panel.failure.empty', action: 'retry' },
  credits: { messageKey: 'chat.panel.failure.credits', action: 'credits' }
};

export function failureOfStatus(status: number): Failure {
  return status === HTTP_PAYMENT_REQUIRED ? 'credits' : 'send';
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
