import { z } from 'zod';
import { tool, type UserContent } from 'ai';
import type { TemplateEntry } from '$lib/motion/template/library';
import { LOOP_RULE } from '$lib/motion/loop';
import { KEY_FIELDS_MAX } from '$lib/motion/template/key-fields';
import { DESCRIBE_FRAMES, MAX_FRAMES_PER_VIEW, VIEW_FRAMES, type Reference } from './frames';
import { READ_COMPONENT, UPDATE_COMPONENTS, WRITE_COMPONENT } from './model-route';
import { CHECK_MOTION, CHECK_FRAMES } from './motion-check';
import { componentContract } from './motion-prompt';
import { THREE_GUIDANCE } from './three-guidance';

export { CRAFT_COMPOSITION } from '$lib/motion/craft';
export const READ_TEMPLATE_SOURCE = 'read_template_source';

export const MAX_CRAFT_ROUNDS = 5;
const DEFAULT_CRAFT_ROUNDS = 4;
const MAX_CRAFT_REFERENCES = 3;
const DEFAULT_CRAFT_USD = 2;
const MIN_CRAFT_USD = 0.3;
export const TARGET_SCORE = 8;
export const COMPARE_REFERENCE = 'compare_reference';
const MAX_CRAFT_USD = 5;
const STEPS_BEFORE_ROUNDS = 8;
const STEPS_PER_ROUND = 7;

export const compareReferenceTool = tool({
  description: `After every ${VIEW_FRAMES} and describe_frames: set your frames next to the reference and list the concrete differences that remain, biggest first, each naming what, where and how much ("bubbles 3x too big and glossy: the reference has dense clusters of tiny matte ones, lower right"), then score the match 1-10 as a strict judge would. Below ${TARGET_SCORE} fix the first differences and look again.`,
  inputSchema: z.object({ differences: z.array(z.string().min(8).max(300)).min(1).max(10), score: z.number().int().min(1).max(10) }),
  execute: async ({ score }) => ({ ok: true, score, keep_going: score < TARGET_SCORE })
});

export const craftStepsFor = (rounds: number) => STEPS_BEFORE_ROUNDS + rounds * STEPS_PER_ROUND;

export const craftInput = z.object({
  brief: z.string().trim().min(10).max(4000).describe('what to make: the reference look and motion in words, the text on screen, how long it runs, loop or not'),
  reference_asset_ids: z.array(z.string()).min(1).max(MAX_CRAFT_REFERENCES).describe('asset ids of the reference pictures (an attached image is in the assets with its id)'),
  rounds: z.number().int().min(1).max(MAX_CRAFT_ROUNDS).default(DEFAULT_CRAFT_ROUNDS).describe('write → look → fix rounds at most'),
  budget_usd: z.number().positive().max(MAX_CRAFT_USD).default(DEFAULT_CRAFT_USD),
  template_name: z.string().trim().min(1).max(60).optional().describe('save the result to the team template library under this name')
});

export type CraftInput = z.infer<typeof craftInput>;

export const CRAFT_TOOLS: readonly string[] = [
  'get_motion_doc',
  'list_assets',
  'list_templates',
  READ_TEMPLATE_SOURCE,
  WRITE_COMPONENT,
  UPDATE_COMPONENTS,
  READ_COMPONENT,
  'add_clip',
  'set_timing',
  'set_props',
  'remove_clip',
  'register_font',
  'fit_duration',
  VIEW_FRAMES,
  DESCRIBE_FRAMES,
  CHECK_MOTION,
  'expose_field',
  'list_fields',
  'precompose',
  'save_template',
  COMPARE_REFERENCE
];

const HOUSE_MOTION = [
  'Moves on strong in-out expo curves (feega.inOut), entrances on feega.out with a tiny soft settle; never bounce, back, elastic or overshoot on a move, never linear entrances.',
  'Scenes of 2–4 s, a change every bar rather than every beat, a hold after each change: calm enough to read, never slow or static.',
  'Few words; titles semibold or medium, tracking −4% to −6%; never a title over busy UI.',
  'Shapes are sharp rectangles or perfect circles only, never an in-between corner radius.',
  LOOP_RULE
];

export function craftSystem(frame: { width: number; height: number }): string {
  return [
    'You craft ONE premium motion composition from scratch, as a custom component, until it matches the reference pictures. You cannot ask the user anything.',
    `1. Study: list_templates, then ${READ_TEMPLATE_SOURCE} two or three library templates closest to the reference. They are the bar: how they split model and view, declare param() fields, stay a pure function of time, and give a live part a still(t). A generative look (blobs, flowing lines, particle ribbons) is a fragment shader or points on the one shared renderer: ${THREE_GUIDANCE}`,
    `2. Write: ${WRITE_COMPONENT} the whole composition, then add_clip component "Custom" over the full length of the video (fit_duration to the length the brief asks).`,
    `3. Look: ${VIEW_FRAMES} at up to ${MAX_FRAMES_PER_VIEW} times spread over the piece; the reference pictures come back next to your frames. ${DESCRIBE_FRAMES}, then list every difference from the reference: composition, scale, colour, light, texture, type, how it moves.`,
    `4. Measure: ${CHECK_MOTION} on the busiest second (${CHECK_FRAMES} consecutive frames) for jolts and frozen frames; ${VIEW_FRAMES} reports a loop seam that jumps.`,
    `5. Compare: ${COMPARE_REFERENCE} after every look, the concrete differences that remain and a strict 1-10 score of the match. Fix the first differences with ${UPDATE_COMPONENTS} and look again. One round is write or fix → look → compare → measure. Keep going until the score reaches ${TARGET_SCORE}, or the rounds or budget run out; never stop on a lower score while rounds are left.`,
    `Generative craft: render shaders supersampled (draw at 2x and let the browser scale down, or average 4 jittered samples per pixel) and antialias every edge (smoothstep over fwidth of the distance), never a hard step. Raymarch with enough steps (96+) and a small epsilon, blend shapes with a smooth minimum, displace the surface with layered noise (fbm) for folds and creases, light it with a fresnel rim and a soft inner glow. Scatter small things the way nature does: clusters around a few seeds, many tiny members and few large ones (radii from a power law), not a handful of equal spheres. Keep text readable over a busy background: a soft dark scrim or glow behind it.`,
    `6. Reuse: the parameters a person would change (the text, the colours, the pictures, the speed) are param() fields; expose_field at most ${KEY_FIELDS_MAX} of them on the clip. When asked to save it as a template: if the video holds other clips, precompose your clip first and save_template with that comp; otherwise save_template without comp, key_fields the exposed keys.`,
    `House motion rules:\n${HOUSE_MOTION.map((r) => `- ${r}`).join('\n')}`,
    componentContract(frame),
    'Last message: what you built, the rounds you ran, and what still differs from the reference, in plain sentences.'
  ].join('\n\n');
}

export function craftBrief(input: CraftInput, references: number): string {
  const save = input.template_name ? ` Then save it as the template "${input.template_name}".` : '';
  return `${input.brief}\n\nThe ${references} picture${references > 1 ? 's' : ''} below ${references > 1 ? 'are' : 'is'} the reference. At most ${input.rounds} rounds.${save}`;
}

export function templateSource(entry: TemplateEntry) {
  const { doc } = entry.template;
  return {
    id: entry.id,
    name: entry.template.name,
    description: entry.template.description,
    seconds: doc.durationInFrames / doc.fps,
    fps: doc.fps,
    key_fields: entry.template.keyFields ?? [],
    components: Object.entries(doc.components).map(([name, c]) => ({ name, mode: c.mode, html: c.source.html, css: c.source.css, js: c.source.js, props: c.propsSchema.properties }))
  };
}

export type ChildCall = { toolCallId: string; toolName: string; input: unknown; output: unknown };

export type CraftAsk = { system: string; content: UserContent; tools: readonly string[]; budgetUsd: number; steps: number; onCalls: (calls: readonly ChildCall[]) => void };

export type CraftPorts = {
  references: (assetIds: readonly string[]) => Promise<Reference[]>;
  run: (ask: CraftAsk) => Promise<{ text: string; usd: number; calls: ChildCall[] }>;
  sheet: (viewCallId: string) => Promise<string | null>;
  remainingUsd: () => number;
};

type Motion = { jolts: unknown[]; frozen: unknown[] };

export type CraftRound = { round: number; score: number | null; differences: string[]; motion: Motion | null; sheet: string | null };

export type CraftProgress = { ok: true; running: true; rounds: number; best_score: number | null; log: CraftRound[]; images: { path: string; round: number }[] };

export type CraftResult = { ok: true; rounds: number; best_score: number | null; cost_usd: number; text: string; budget_usd: number; images: { path: string; round: number }[]; log: CraftRound[] } | { ok: false; error: string };

type Compared = { score: number; differences: string[] };

function roundsOf(calls: readonly ChildCall[], sheets: ReadonlyMap<string, string | null>): CraftRound[] {
  const rounds: CraftRound[] = [];
  for (const call of calls) {
    const current = rounds.at(-1);
    if (call.toolName === VIEW_FRAMES) {
      rounds.push({ round: rounds.length + 1, score: null, differences: [], motion: null, sheet: sheets.get(call.toolCallId) ?? null });
      continue;
    }
    if (!current) {
      continue;
    }
    if (call.toolName === COMPARE_REFERENCE) {
      const compared = call.input as Compared;
      current.score = compared.score;
      current.differences = compared.differences;
    }
    const measured = call.output as (Motion & { ok?: boolean }) | null;
    if (call.toolName === CHECK_MOTION && measured?.ok) {
      current.motion = { jolts: measured.jolts, frozen: measured.frozen };
    }
  }
  return rounds;
}

const bestOf = (log: readonly CraftRound[]) => log.reduce<number | null>((best, r) => (r.score === null ? best : Math.max(best ?? 0, r.score)), null);

const imagesOf = (log: readonly CraftRound[]) => log.flatMap((r) => (r.sheet ? [{ path: r.sheet, round: r.round }] : []));

export async function craftRun(ports: CraftPorts, input: CraftInput, ctx: { session: { references?: Reference[] }; frame: { width: number; height: number }; progress?: (update: CraftProgress) => void }): Promise<CraftResult> {
  const budgetUsd = Math.min(input.budget_usd, ports.remainingUsd());
  if (budgetUsd < MIN_CRAFT_USD) {
    return { ok: false, error: `budget: only $${Math.max(0, budgetUsd).toFixed(2)} is left of this video, less than one crafting round` };
  }
  const references = await ports.references(input.reference_asset_ids);
  if (!references.length) {
    return { ok: false, error: 'no reference picture could be read from those asset ids: attach or import the reference first' };
  }

  const sheets = new Map<string, Promise<string | null>>();
  const resolved = async (calls: readonly ChildCall[]) => {
    const views = calls.filter((c) => c.toolName === VIEW_FRAMES).map((c) => c.toolCallId);
    views.filter((id) => !sheets.has(id)).forEach((id) => sheets.set(id, ports.sheet(id)));
    return new Map(await Promise.all(views.map(async (id) => [id, await sheets.get(id)!] as const)));
  };

  let reported = '';
  let reporting: Promise<void> = Promise.resolve();
  const report = (calls: readonly ChildCall[]) => {
    reporting = reporting.then(async () => {
      const log = roundsOf(calls, await resolved(calls));
      const closed = JSON.stringify(log.map((r) => [r.score, r.motion]));
      if (closed === reported || !ctx.progress) {
        return;
      }
      reported = closed;
      ctx.progress({ ok: true, running: true, rounds: log.length, best_score: bestOf(log), log, images: imagesOf(log) });
    });
  };

  const before = ctx.session.references;
  ctx.session.references = references;
  try {
    const content: UserContent = [{ type: 'text', text: craftBrief(input, references.length) }, ...references.map((r) => ({ type: 'image' as const, image: r.data, mediaType: r.mediaType }))];
    const out = await ports.run({ system: craftSystem(ctx.frame), content, tools: CRAFT_TOOLS, budgetUsd, steps: craftStepsFor(input.rounds), onCalls: report });
    await reporting;
    const log = roundsOf(out.calls, await resolved(out.calls));
    return { ok: true, rounds: log.length, best_score: bestOf(log), cost_usd: out.usd, budget_usd: budgetUsd, text: out.text, images: imagesOf(log), log };
  } finally {
    ctx.session.references = before;
  }
}
