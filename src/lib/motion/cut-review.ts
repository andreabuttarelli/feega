import { choosesForUser } from '$lib/reference-pick';

export const REVIEW_CUT = 'review_cut';

export type CutReview = { score: number; fixes: string[]; sheet: string | null };

export enum CutGate {
  Ask = 'ask',
  Auto = 'auto'
}

export enum CutAnswer {
  Apply = 'apply',
  ApplyAlways = 'apply-always',
  Ship = 'ship'
}

const APPLY_HEAD = "Apply the critic's fixes";
const GO_AHEAD = 'Go ahead without asking from now on.';

const fixList = (fixes: readonly string[]) => fixes.map((f) => `- ${f}`).join('\n');

const ANSWERS: Record<CutAnswer, (fixes: readonly string[]) => string> = {
  [CutAnswer.Apply]: (fixes) => `${APPLY_HEAD}, worst first:\n${fixList(fixes)}`,
  [CutAnswer.ApplyAlways]: (fixes) => `${APPLY_HEAD}, worst first:\n${fixList(fixes)}\n${GO_AHEAD}`,
  [CutAnswer.Ship]: () => 'Ship the cut as it is: no more changes.'
};

export const cutAnswer = (answer: CutAnswer, fixes: readonly string[]) => ANSWERS[answer](fixes);


export const answersCut = (message: string): boolean => message.startsWith(APPLY_HEAD);

export const cutAnswers = (fixes: readonly string[]): Record<CutAnswer, string> => ({ [CutAnswer.Apply]: cutAnswer(CutAnswer.Apply, fixes), [CutAnswer.ApplyAlways]: cutAnswer(CutAnswer.ApplyAlways, fixes), [CutAnswer.Ship]: cutAnswer(CutAnswer.Ship, fixes) });

type ToolOutcome = { toolName: string; output?: unknown };
type Message = { role: string; content: string; tools?: ToolOutcome[]; live?: boolean; pending?: boolean };
type Step = { content: ReadonlyArray<{ type: string; toolName?: string; output?: unknown }> };

function savedReview(tool: ToolOutcome): CutReview | null {
  const out = tool.output as { ok?: unknown; score?: unknown; fixes?: unknown; sheet?: unknown } | undefined;
  if (tool.toolName !== REVIEW_CUT || out?.ok !== true || typeof out.score !== 'number' || !Array.isArray(out.fixes)) {
    return null;
  }
  return { score: out.score, fixes: out.fixes as string[], sheet: typeof out.sheet === 'string' ? out.sheet : null };
}

export function pendingReview(messages: readonly Message[]): CutReview | null {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || last.live || last.pending) {
    return null;
  }
  return (last.tools ?? []).map(savedReview).findLast((r) => r !== null) ?? null;
}

export const reviewAwaits = (steps: readonly Step[]): boolean => (steps.at(-1)?.content ?? []).some((p) => p.type === 'tool-result' && savedReview({ toolName: p.toolName ?? '', output: p.output }) !== null);

export function cutGate(message: string, turns: readonly { role: string; content: string }[]): CutGate {
  const said = [...turns, { role: 'user', content: message }].some((t) => t.role === 'user' && t.content.includes(GO_AHEAD));
  return said || choosesForUser(message) ? CutGate.Auto : CutGate.Ask;
}
