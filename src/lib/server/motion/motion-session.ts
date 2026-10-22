import { briefAwaits } from '$lib/motion/script-brief';
import { pickAwaits, type PickAnswer, type PickAsk } from '$lib/reference-pick';
import { createUIMessageStream, type Tool, type UIMessageChunk } from 'ai';
import { selfCheckChoice, type ForcedTool } from '$lib/server/motion/model-route';
import { ReplyStatus, type Reply } from '$lib/server/repos/chat-reply';
import { agentStopWhen } from '$lib/server/project-agent/limits';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { VIDEO_BUDGET, type BudgetCard } from '$lib/server/motion/video-budget';
import { type CutReview } from '$lib/motion/cut-review';
import type { SavedTool } from '$lib/server/repos/chat';
import type { LaunchScript } from '$lib/motion/script';
import { StudioRole } from '$lib/server/motion/studio-roster';
import { type MotionToolDeps } from '$lib/server/motion/motion-tools';
import type { MotionAsset } from '$lib/server/motion/editor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { SELF_CHECK_MAX_STEPS, Vision } from '$lib/server/motion/frames';
import { CLOSING_RESERVE_MS, oneStep, writeText, type Stop, type TurnStep } from '$lib/server/agents/turn-core';

export const CHECK_WAIT_MS = 90_000;
export const NEEDS_EDITOR = 'this needs the motion editor open in a browser to draw frames: nobody has it open for this turn';

export enum Browser {
  Attached = 'attached',
  Absent = 'absent'
}

export const BROWSER_VISION: Record<Browser, (visionModel: string | null) => Vision> = {
  [Browser.Attached]: (visionModel) => (visionModel ? Vision.Available : Vision.Missing),
  [Browser.Absent]: (visionModel) => (visionModel && serverFramesOpen() ? Vision.Available : Vision.Missing)
};

export const EDITOR_DRAWS: Record<Browser, boolean> = { [Browser.Attached]: true, [Browser.Absent]: false };

export const BROWSER_DRAWS: Record<Browser, () => void> = {
  [Browser.Attached]: () => {},
  [Browser.Absent]: () => {
    throw new Error(NEEDS_EDITOR);
  }
};

export enum Round {
  Research = 'research',
  Sound = 'sound',
  Edit = 'edit',
  SelfCheck = 'self-check',
  Summary = 'summary'
}

export const MAX_DELIVERY_ATTEMPTS = 3;
export const STILL_OPEN_ID = 'still-open';
export const LAST_LOOK_ID = 'last-look';
export const CRITIC_ID = 'critic-sheet';
export const LOOP_SEAM_ID = 'loop-seam';
export const CUT_REVIEW_ID = 'cut-review';
export const SHEET_FILE = 'sheet.jpg';

export const selfCheckSpent: Stop = ({ steps }) => steps.length >= SELF_CHECK_MAX_STEPS;

export const awaitsUser = (steps: readonly TurnStep[]) => briefAwaits(steps) || pickAwaits(steps);

export const userAsked: Stop = ({ steps }) => awaitsUser(steps as TurnStep[]);

export const ROUND_ROLE: Record<Round, StudioRole | null> = { [Round.Research]: StudioRole.Researcher, [Round.Sound]: StudioRole.Sound, [Round.Edit]: null, [Round.SelfCheck]: null, [Round.Summary]: null };

export const CREWS = 2;

export type Crew = { acts: string[]; from: number; to: number };

export function shotCrews(script: LaunchScript): Crew[] {
  const size = Math.ceil(script.acts.length / CREWS);
  return Array.from({ length: CREWS }, (_, i) => script.acts.slice(i * size, (i + 1) * size))
    .filter((acts) => acts.length)
    .map((acts) => ({ acts: acts.map((a) => a.act), from: acts[0].start, to: acts.at(-1)!.end }));
}

export const PLACES_AT = ['add_shot', 'add_template'] as const;

export type Placing = { at: number };

export function inRange(tool: Tool, crew: Crew): Tool {
  return {
    ...tool,
    execute: async (input: Placing, options) =>
      input.at < crew.from || input.at >= crew.to ? { ok: false, error: `${input.at} s is outside your range ${crew.from} s to ${crew.to} s: the other crew builds that part` } : tool.execute!(input, options)
  } as Tool;
}

export function crewTools<T extends Record<string, Tool>>(all: T, crew: Crew): T {
  const guarded = PLACES_AT.filter((name) => all[name]?.execute).map((name) => [name, inRange(all[name], crew)]);
  return { ...all, ...Object.fromEntries(guarded) };
}

export const crewBrief = (crew: Crew) => `Shot crew: build only the ${crew.acts.join(', ')} acts of the script, from ${crew.from} s to ${crew.to} s. Each section starts from a library template (list_templates by role, add_template inside your range, set_template_fields from the script lines); library shots only for the beats no template covers. Another crew builds the rest at the same time: never place, move or remove anything outside your range, and leave music to the sound pass.`;

export const RESEARCH_BRIEF = 'Research step: gather the facts, captures and references this video needs. You do not build and you do not answer the user: the director writes the script from your findings next, and the shots are built on the next ask.';

export const RESEARCH_DONE = 'Research is done: the facts, captures and references are in the conversation above. Now write the script and the storyboard from them.';
export const SOUND_PASS = 'Sound pass: lay the music under the whole video if there is none, mark its beats and cut the shots onto them. Change nothing else.';

export const ROUND_STOPS: Record<Round, (t0: number, overBudget: Stop) => Stop[]> = {
  [Round.Research]: (t0, overBudget) => [agentStopWhen(t0 - CLOSING_RESERVE_MS), overBudget, userAsked],
  [Round.Sound]: (t0, overBudget) => [agentStopWhen(t0), overBudget, selfCheckSpent],
  [Round.Edit]: (t0, overBudget) => [agentStopWhen(t0 - CLOSING_RESERVE_MS), overBudget, userAsked],
  [Round.SelfCheck]: (t0, overBudget) => [agentStopWhen(t0), selfCheckSpent, overBudget],
  [Round.Summary]: () => [oneStep]
};

export type Choice = ForcedTool | { toolChoice: 'none' };

export type ChoiceInput = Parameters<typeof selfCheckChoice>[0] & { stepNumber: number };

export const ROUND_CHOICE: Record<Round, (input: ChoiceInput) => Choice> = {
  [Round.Research]: () => ({}),
  [Round.Sound]: () => ({}),
  [Round.Edit]: () => ({}),
  [Round.SelfCheck]: (input) => (input.stepNumber === 0 ? selfCheckChoice(input) : {}),
  [Round.Summary]: () => ({ toolChoice: 'none' })
};

export type Followed = { ids: string[]; note: string };

export async function importFollowed(answer: PickAnswer | null, importAsset: MotionToolDeps['importAsset'], assets: MotionAsset[]): Promise<Followed> {
  if (!answer?.follow.length || !importAsset) {
    return { ids: [], note: '' };
  }
  const landed = await Promise.all(answer.follow.map(async (c) => ({ c, out: await importAsset(c.image, c.title) })));
  const ok = landed.flatMap(({ c, out }) => (out.ok ? [{ c, asset: out.asset }] : []));
  assets.push(...ok.map((o) => o.asset));
  const lines = ok.map(({ c, asset }) => `- ${c.title || c.id}: asset ${asset.id}`);
  return { ids: ok.map((o) => o.asset.id), note: lines.length ? `The references the user follows are now project assets: hang each under the storyboard beat it inspires (write_storyboard media) and take the look from them:\n${lines.join('\n')}` : '' };
}

export type TurnOutcome = { reply: string; summary: string | null; version: number | null; revision: RevisionOutcome | null; costUsd: number; pick: PickAsk | null; cut: CutReview | null; budget: BudgetCard | null; scripted: boolean };

export type MotionTurn = { stream: ReadableStream<UIMessageChunk>; done: Promise<TurnOutcome> };

export const CANNED_ID = 'canned';
export const BUDGET_ID = 'video-budget';

export const budgetTool = (card: BudgetCard): SavedTool => ({ toolCallId: BUDGET_ID, toolName: VIDEO_BUDGET, status: 'done', input: {}, output: card });

export function writeCard(writer: { write: (chunk: UIMessageChunk) => void }, card: BudgetCard): void {
  writer.write({ type: 'tool-input-available', toolCallId: BUDGET_ID, toolName: VIDEO_BUDGET, input: {} });
  writer.write({ type: 'tool-output-available', toolCallId: BUDGET_ID, output: card });
}

export function cannedTurn(content: string, reply: Pick<Reply, 'finish'>, card: BudgetCard | null = null): MotionTurn {
  const done = reply.finish({ content, tools: card ? [budgetTool(card)] : [] }, ReplyStatus.Done).then((): TurnOutcome => ({ reply: content, summary: null, version: null, revision: null, costUsd: 0, pick: null, cut: null, budget: card, scripted: false }));
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writeText(writer, CANNED_ID, content);
      if (card) {
        writeCard(writer, card);
      }
      writer.write({ type: 'finish' });
    }
  });
  return { stream, done };
}
