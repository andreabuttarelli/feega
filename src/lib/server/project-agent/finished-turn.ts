import type { SavedTool } from '$lib/server/repos/chat';

type StepPart = { type: string; toolCallId?: string; toolName?: string; input?: unknown; output?: unknown; error?: unknown };
type FinishedStep = { text: string; content: ReadonlyArray<StepPart> };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function savedTool(part: StepPart): SavedTool | null {
  const base = { toolCallId: part.toolCallId ?? '', toolName: part.toolName ?? 'tool', input: part.input };
  if (part.type === 'tool-result') {
    return { ...base, status: 'done', output: part.output };
  }
  if (part.type === 'tool-error') {
    return { ...base, status: 'error', errorText: errorText(part.error) };
  }
  return null;
}

const STEP_BREAK = '\n\n';
const EDGE_SPACE = /\s/;

function joined(sofar: string, next: string): string {
  const glued = !sofar || !next || EDGE_SPACE.test(sofar.at(-1)!) || EDGE_SPACE.test(next[0]);
  return glued ? sofar + next : sofar + STEP_BREAK + next;
}

export function finishedTurn(steps: ReadonlyArray<FinishedStep>): { content: string; tools: SavedTool[] } {
  return {
    content: steps.map((s) => s.text).reduce(joined, ''),
    tools: steps.flatMap((s) => s.content.map(savedTool).filter((t): t is SavedTool => t !== null))
  };
}
