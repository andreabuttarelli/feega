import { z } from 'zod';

export const ASK_REFERENCE_PICK = 'ask_reference_pick';
export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 12;
export const MAX_REJECTED_ROUNDS = 3;

const OPEN_TAG = '<reference-pick>';
const CLOSE_TAG = '</reference-pick>';
const PAYLOAD = /<reference-pick>([\s\S]*?)<\/reference-pick>/;
const TOOL_RESULT = 'tool-result';
const CHOOSE_FOR_ME = /\b(scegli tu|decidi tu|scegli(?:li|le)? per me|choose for me|you choose|pick for me|your call)\b/i;

export const candidateSchema = z.object({
  id: z.string().min(1).max(200),
  image: z.string().url().max(2000),
  title: z.string().max(200).optional(),
  why: z.string().max(240).optional()
});

export const pickAskSchema = z.object({
  question: z.string().min(2).max(300),
  candidates: z.array(candidateSchema).min(MIN_CANDIDATES).max(MAX_CANDIDATES),
  min: z.number().int().min(0).max(MAX_CANDIDATES).optional(),
  max: z.number().int().min(1).max(MAX_CANDIDATES).optional()
});

export type Candidate = z.infer<typeof candidateSchema>;
export type PickAsk = { question: string; candidates: Candidate[]; min: number; max: number };
export type PickAnswer = { follow: Candidate[]; avoid: Candidate[]; note: string; rejected?: true; query?: string };

export enum Mark {
  Follow = 'follow',
  Avoid = 'avoid',
  Neutral = 'neutral'
}

export enum PickState {
  Waiting = 'waiting',
  Answered = 'answered',
  Passed = 'passed'
}

export const NEXT_MARK: Record<Mark, Mark> = { [Mark.Neutral]: Mark.Follow, [Mark.Follow]: Mark.Avoid, [Mark.Avoid]: Mark.Neutral };

type ToolOutcome = { toolName: string; output?: unknown };
type Message = { role: 'user' | 'assistant'; content: string; tools?: ToolOutcome[] };
type Step = { content: ReadonlyArray<{ type: string; toolName?: string; output?: unknown }> };

export function pickAsk(input: z.infer<typeof pickAskSchema>): PickAsk {
  const max = Math.min(input.max ?? input.candidates.length, input.candidates.length);
  return { question: input.question, candidates: input.candidates, min: Math.min(input.min ?? 1, max), max };
}

export function savedPick(tool: ToolOutcome): PickAsk | null {
  const out = tool.output as ({ ok?: unknown } & Partial<PickAsk>) | undefined;
  if (tool.toolName !== ASK_REFERENCE_PICK || out?.ok !== true || !Array.isArray(out.candidates) || typeof out.question !== 'string') {
    return null;
  }
  return { question: out.question, candidates: out.candidates, min: out.min ?? 1, max: out.max ?? out.candidates.length };
}

export const pickOf = (message: Message): PickAsk | null => (message.tools ?? []).map(savedPick).findLast((p) => p !== null) ?? null;

export function pickAwaits(steps: readonly Step[]): boolean {
  return (steps.at(-1)?.content ?? []).some((p) => p.type === TOOL_RESULT && savedPick({ toolName: p.toolName ?? '', output: p.output }) !== null);
}

export function answerText(ask: PickAsk, marks: Readonly<Record<string, Mark>>, note: string): string {
  const marked = (mark: Mark) => ask.candidates.filter((c) => marks[c.id] === mark);
  const answer: PickAnswer = { follow: marked(Mark.Follow), avoid: marked(Mark.Avoid), note: note.trim() };
  const line = `References: follow ${answer.follow.length}, avoid ${answer.avoid.length}.${answer.note ? ` ${answer.note}` : ''}`;
  return `${line}\n\n${OPEN_TAG}${JSON.stringify(answer)}${CLOSE_TAG}`;
}

const tagged = (line: string, answer: PickAnswer) => `${line}\n\n${OPEN_TAG}${JSON.stringify(answer)}${CLOSE_TAG}`;

export function rejectText(ask: PickAsk, query: string, avoidAll: boolean): string {
  const wanted = query.trim();
  const answer: PickAnswer = { follow: [], avoid: avoidAll ? ask.candidates : [], note: '', rejected: true, query: wanted };
  return tagged(`None of these references: search again${wanted ? ` for ${wanted}` : ''}.`, answer);
}

export function readAnswer(text: string): PickAnswer | null {
  const payload = PAYLOAD.exec(text)?.[1];
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<PickAnswer>;
    if (!Array.isArray(parsed.follow) || !Array.isArray(parsed.avoid)) {
      return null;
    }
    const base = { follow: parsed.follow, avoid: parsed.avoid, note: parsed.note ?? '' };
    return parsed.rejected ? { ...base, rejected: true, query: parsed.query ?? '' } : base;
  } catch {
    return null;
  }
}

export const answerLabel = (text: string): string => text.replace(PAYLOAD, '').trim();

export const latestAnswer = (turns: readonly { role: string; content: string }[]): PickAnswer | null =>
  turns
    .filter((t) => t.role === 'user')
    .map((t) => readAnswer(t.content))
    .findLast((a) => a !== null) ?? null;

export const shownRefs = (turns: readonly Message[]): ReadonlySet<string> =>
  new Set(turns.flatMap((t) => (t.role === 'assistant' ? (t.tools ?? []).map(savedPick).flatMap((p) => (p?.candidates ?? []).flatMap((c) => [c.id, c.image])) : [])));

export function rejectedRounds(turns: readonly { role: string; content: string }[]): number {
  const answers = turns.filter((t) => t.role === 'user').map((t) => readAnswer(t.content)).filter((a) => a !== null);
  const lastKept = answers.findLastIndex((a) => !a.rejected);
  return answers.length - 1 - lastKept;
}

export const avoidedImages = (answer: PickAnswer | null): ReadonlySet<string> => new Set((answer?.avoid ?? []).map((c) => c.image));

export type PickCard = { ask: PickAsk; state: PickState; answer: PickAnswer | null };

export function pickCards(messages: readonly Message[]): Map<number, PickCard> {
  const cards = new Map<number, PickCard>();
  messages.forEach((message, i) => {
    const ask = message.role === 'assistant' ? pickOf(message) : null;
    if (!ask) {
      return;
    }
    const next = messages[i + 1];
    const answer = next?.role === 'user' ? readAnswer(next.content) : null;
    const state = answer ? PickState.Answered : next ? PickState.Passed : PickState.Waiting;
    cards.set(i, { ask, state, answer });
  });
  return cards;
}

export const choosesForUser = (message: string): boolean => CHOOSE_FOR_ME.test(message);
