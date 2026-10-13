import { z } from 'zod';
import type { UserContent } from 'ai';
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
const DEFAULT_CRAFT_USD = 2.5;
const MAX_CRAFT_USD = 5;
const STEPS_BEFORE_ROUNDS = 8;
const STEPS_PER_ROUND = 7;

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
  'save_template'
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
    `5. Fix the biggest differences first with ${UPDATE_COMPONENTS}, then look again. One round is write or fix → look → measure. Stop at the round limit, or earlier when nothing important differs and the checks are clean.`,
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

export type CraftAsk = { system: string; content: UserContent; tools: readonly string[]; budgetUsd: number; steps: number };

export type CraftPorts = {
  references: (assetIds: readonly string[]) => Promise<Reference[]>;
  run: (ask: CraftAsk) => Promise<{ text: string; usd: number; views: string[] }>;
  sheet: (viewCallId: string) => Promise<string | null>;
  remainingUsd: () => number;
};

export type CraftResult = { ok: true; rounds: number; cost_usd: number; text: string; images: { path: string; round: number }[] } | { ok: false; error: string };

export async function craftRun(ports: CraftPorts, input: CraftInput, ctx: { session: { references?: Reference[] }; frame: { width: number; height: number } }): Promise<CraftResult> {
  if (input.budget_usd > ports.remainingUsd()) {
    return { ok: false, error: `budget $${input.budget_usd.toFixed(2)} is more than this turn has left: $${Math.max(0, ports.remainingUsd()).toFixed(2)}` };
  }
  const references = await ports.references(input.reference_asset_ids);
  if (!references.length) {
    return { ok: false, error: 'no reference picture could be read from those asset ids: attach or import the reference first' };
  }

  const before = ctx.session.references;
  ctx.session.references = references;
  try {
    const content: UserContent = [{ type: 'text', text: craftBrief(input, references.length) }, ...references.map((r) => ({ type: 'image' as const, image: r.data, mediaType: r.mediaType }))];
    const out = await ports.run({ system: craftSystem(ctx.frame), content, tools: CRAFT_TOOLS, budgetUsd: input.budget_usd, steps: craftStepsFor(input.rounds) });
    const sheets = await Promise.all(out.views.map(ports.sheet));
    const images = sheets.flatMap((path, i) => (path ? [{ path, round: i + 1 }] : []));
    return { ok: true, rounds: out.views.length, cost_usd: out.usd, text: out.text, images };
  } finally {
    ctx.session.references = before;
  }
}
