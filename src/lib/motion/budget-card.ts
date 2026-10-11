export const VIDEO_BUDGET = 'video_budget';

export const CONTINUE_MESSAGE = 'Continue where you stopped.';

export type BudgetCard = { ok: true; spent_usd: number; cap_usd: number; raise_usd: number };

type Message = { role: string; content: string; tools?: { toolName: string; output?: unknown }[]; live?: boolean; pending?: boolean };

const cardOf = (tool: { toolName: string; output?: unknown }): BudgetCard | null => {
  const out = tool.output as Partial<BudgetCard> | undefined;
  return tool.toolName === VIDEO_BUDGET && out?.ok === true && typeof out.spent_usd === 'number' ? (out as BudgetCard) : null;
};

export function pendingBudget(messages: readonly Message[]): BudgetCard | null {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || last.live || last.pending) {
    return null;
  }
  return (last.tools ?? []).map(cardOf).findLast((c) => c !== null) ?? null;
}

export const budgetRaisePath = (projectId: string, nodeId: string) => `/api/v1/projects/${projectId}/motion/${nodeId}/agent/budget`;
