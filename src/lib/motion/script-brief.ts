export const WRITE_SCRIPT = 'write_script';
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

export function briefAwaits(steps: readonly Step[]): boolean {
  return (steps.at(-1)?.content ?? []).some((p) => p.type === TOOL_RESULT && savedBrief({ toolName: p.toolName ?? '', output: p.output }) !== null);
}
