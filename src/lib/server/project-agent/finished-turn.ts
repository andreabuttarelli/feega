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

export function finishedTurn(steps: ReadonlyArray<FinishedStep>): { content: string; tools: SavedTool[] } {
  return {
    content: steps.map((s) => s.text).join(''),
    tools: steps.flatMap((s) => s.content.map(savedTool).filter((t): t is SavedTool => t !== null))
  };
}
