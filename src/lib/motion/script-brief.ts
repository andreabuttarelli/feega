import type { MotionDoc } from './doc';
import type { OutlinePoint } from './storyboard';

export const WRITE_SCRIPT = 'write_script';
export const WRITE_STORYBOARD = 'write_storyboard';
export const BRIEF_AUTO_GO_S = 8;
export const GO_MESSAGE = 'Go: build the video from this script.';

type ToolOutcome = { toolName: string; output?: unknown };
type Message = { role: 'user' | 'assistant'; content: string; tools?: ToolOutcome[]; live?: boolean; pending?: boolean };
type StepPart = { type: string; toolName?: string; output?: unknown };
type Step = { content: ReadonlyArray<StepPart> };

const TOOL_RESULT = 'tool-result';

export function savedBrief(tool: ToolOutcome): string | null {
  const out = tool.output as { ok?: unknown; brief?: unknown } | undefined;
  if (tool.toolName !== WRITE_SCRIPT || out?.ok !== true || typeof out.brief !== 'string') {
    return null;
  }
  return out.brief;
}

export function pendingBrief(messages: readonly Message[]): string | null {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || last.live || last.pending) {
    return null;
  }
  return (last.tools ?? []).map(savedBrief).findLast((b) => b !== null) ?? null;
}

export type BoardOutline = { canvasId: string; outline: OutlinePoint[] };

function savedBoard(tool: ToolOutcome): BoardOutline | null {
  const out = tool.output as { ok?: unknown; canvas_id?: unknown; outline?: unknown } | undefined;
  if (tool.toolName !== WRITE_STORYBOARD || out?.ok !== true || typeof out.canvas_id !== 'string' || !Array.isArray(out.outline)) {
    return null;
  }
  return { canvasId: out.canvas_id, outline: out.outline as OutlinePoint[] };
}

export function pendingBoard(messages: readonly Message[]): BoardOutline | null {
  return (messages.at(-1)?.tools ?? []).map(savedBoard).findLast((b) => b !== null) ?? null;
}

export function briefAwaits(steps: readonly Step[]): boolean {
  return (steps.at(-1)?.content ?? []).some((p) => p.type === TOOL_RESULT && savedBrief({ toolName: p.toolName ?? '', output: p.output }) !== null);
}

export const promptTexts = (message: string, doc: Pick<MotionDoc, 'script'>): string[] => (doc.script ? [message, JSON.stringify(doc.script)] : [message]);
