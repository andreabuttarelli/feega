import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { Severity, severityOf, type QualityProblem } from '$lib/motion/direction';
import { DESCRIBE_FRAMES, MAX_FRAMES_PER_VIEW, VIEW_FRAMES } from './frames';

export const GATE_SHOWN = 5;

const SAME_TIME_S = 0.01;
const LINE_MAX = 300;

const READS: ReadonlySet<string> = new Set([
  DESCRIBE_FRAMES,
  VIEW_FRAMES,
  'get_motion_doc',
  'list_components',
  'list_assets',
  'list_effects',
  'list_layouts',
  'list_fields',
  'list_fonts',
  'list_shots',
  'list_templates',
  'get_template',
  'list_revisions',
  'read_storyboard',
  'read_component'
]);

const FrameLine = z.object({
  time: z.number().min(0),
  visible: z.string().min(3).max(LINE_MAX).describe('what is actually on screen: elements, words, colours, where they sit'),
  wrong: z.string().min(1).max(LINE_MAX).describe('what is wrong in this frame as seen, or "nothing"')
});

export type FrameLine = z.infer<typeof FrameLine>;

export type Viewing = { times: number[]; described: boolean; lines?: FrameLine[] };

export enum Looks {
  Describes = 'describes',
  Blind = 'blind'
}

export type LookSession = { look?: Viewing; looks?: Looks };

export const DESCRIBE_ASK = `Before anything else, call ${DESCRIBE_FRAMES} with one line per frame: what is visible (elements, words, colours, where they sit) and what is wrong, judged from the pictures alone. Edits are refused until you do.`;

const pending = (session: LookSession) => session.looks !== Looks.Blind && session.look && !session.look.described;

const refusal = (session: LookSession) => ({ ok: false, error: `describe the frames you last viewed (${session.look?.times.map((t) => `${t}s`).join(', ')}) with ${DESCRIBE_FRAMES} first: one line per frame, what is visible and what is wrong` });

type Execute = (input: unknown, options: unknown) => Promise<unknown>;

export function lookFirst(tools: Record<string, Tool>, session: LookSession): Record<string, Tool> {
  const guarded = (name: string, execute: Execute): Execute => (input, options) => {
    if (pending(session) && !READS.has(name)) {
      return Promise.resolve(refusal(session));
    }
    return execute(input, options);
  };
  return Object.fromEntries(Object.entries(tools).map(([name, t]) => [name, t.execute ? { ...t, execute: guarded(name, t.execute as Execute) } : t]));
}

const covered = (lines: readonly FrameLine[], time: number) => lines.some((l) => Math.abs(l.time - time) < SAME_TIME_S);

export function describeFramesTool(session: LookSession): Tool {
  return tool({
    description: `After every ${VIEW_FRAMES}: say what you SEE, one line per frame, before reading the gate or editing. visible: what is on screen (elements, words, colours, where they sit); wrong: what is wrong in it as seen (clipped, empty, unreadable, off-brand), or "nothing". Judge the pictures, not the gate text.`,
    inputSchema: z.object({ frames: z.array(FrameLine).min(1).max(MAX_FRAMES_PER_VIEW) }),
    execute: async ({ frames }) => {
      const look = session.look;
      if (!look) {
        return { ok: false, error: `nothing to describe: call ${VIEW_FRAMES} first` };
      }
      const missing = look.times.filter((t) => !covered(frames, t));
      if (missing.length) {
        return { ok: false, error: `no line for the frame at ${missing.map((t) => `${t}s`).join(', ')}: one line per frame viewed` };
      }
      session.look = { ...look, described: true, lines: frames };
      return { ok: true, described: frames.length };
    }
  });
}

export function ownLook(tools: Record<string, Tool>, looks: Looks): Record<string, Tool> {
  const session: LookSession = { looks };
  const view = tools[VIEW_FRAMES];
  const viewed: Execute = async (input, options) => {
    const out = (await (view.execute as Execute)(input, options)) as { times?: number[] };
    if (out?.times) {
      session.look = { times: out.times, described: false };
    }
    return out;
  };
  const own = { ...tools, ...(view?.execute ? { [VIEW_FRAMES]: { ...view, execute: viewed } as Tool } : {}), [DESCRIBE_FRAMES]: describeFramesTool(session) };
  return lookFirst(own, session);
}

const RANK: Record<Severity, number> = { [Severity.Blocking]: 0, [Severity.Warning]: 1 };

export function gateBlock(problems: readonly QualityProblem[]): string {
  const byCheck = new Map<string, { problem: QualityProblem; count: number }>();
  for (const problem of problems) {
    const check = problem.effect ?? problem.kind;
    const seen = byCheck.get(check);
    byCheck.set(check, seen ? { ...seen, count: seen.count + 1 } : { problem, count: 1 });
  }
  if (!byCheck.size) {
    return '';
  }

  const ranked = [...byCheck.values()].sort((a, b) => RANK[severityOf(a.problem)] - RANK[severityOf(b.problem)]);
  const shown = ranked.slice(0, GATE_SHOWN).map(({ problem, count }) => `- ${severityOf(problem)}: ${problem.detail}${count > 1 ? ` (${count}× in this video)` : ''}`);
  const more = ranked.length - shown.length;
  return ['Quality gate (measured, not seen; check it against your own description):', ...shown, ...(more > 0 ? [`(${more} more, lower in priority: fix these first)`] : [])].join('\n');
}
