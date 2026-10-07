import { z } from 'zod';

export enum Act {
  Problem = 'problem',
  Solution = 'solution',
  Proof = 'proof',
  Claim = 'claim'
}

export enum BrandKind {
  Real = 'real',
  Fictional = 'fictional'
}

export const ACTS = [Act.Problem, Act.Solution, Act.Proof, Act.Claim] as const;

const TEXT = 400;

export const sourceSchema = z.object({ url: z.string().min(4).max(2000), quote: z.string().min(3).max(TEXT) });

export const researchSchema = z.object({
  audience: z.string().min(3).max(TEXT),
  problem: z.string().min(3).max(TEXT),
  struggle: z.string().min(3).max(TEXT),
  flow: z.array(z.string().min(3).max(TEXT)).min(2).max(5),
  benefits: z.array(z.object({ claim: z.string().min(3).max(TEXT), source: sourceSchema })).min(1).max(3),
  numbers: z.array(z.object({ value: z.string().min(1).max(80), source: sourceSchema })).max(4).default([]),
  tone: z.string().min(3).max(TEXT),
  promise: z.object({ text: z.string().min(3).max(TEXT), source: sourceSchema })
});

export const actSchema = z.object({
  act: z.enum(ACTS),
  start: z.number().min(0),
  end: z.number().positive(),
  scene: z.string().min(3).max(TEXT),
  on_screen: z.array(z.string().min(1).max(160)).min(1).max(6),
  ui: z.string().max(TEXT).default(''),
  sources: z.array(sourceSchema).max(4).default([])
});

export const scriptSchema = z.object({ brand: z.enum(BrandKind).default(BrandKind.Real), research: researchSchema, acts: z.array(actSchema).length(ACTS.length) });

export type Research = z.infer<typeof researchSchema>;
export type ScriptAct = z.infer<typeof actSchema>;
export type LaunchScript = z.infer<typeof scriptSchema>;
export type Source = z.infer<typeof sourceSchema>;

const MIN_UI_DETAIL = 40;

const NEEDS: Record<Act, (act: ScriptAct, research: Research) => string | null> = {
  [Act.Problem]: (a) => (a.ui.length < MIN_UI_DETAIL ? 'the problem act shows the "before": a recognisable, messy or slow screen described with its real-looking data (names, counts, states)' : null),
  [Act.Solution]: (a, r) => (a.ui.length < MIN_UI_DETAIL ? `the solution act shows the product's real flow (${r.flow.join(' → ')}) with specific content, never empty boxes` : null),
  [Act.Proof]: (a) => (a.sources.length ? null : 'the proof act shows a number or a result from the site, with its source'),
  [Act.Claim]: (a, r) => (a.on_screen.some((t) => t.toLowerCase().includes(r.promise.text.toLowerCase())) ? null : `the claim act puts the site's own promise on screen: "${r.promise.text}"`)
};

export function scriptProblems(script: LaunchScript): string[] {
  const order = script.acts.map((a) => a.act).join(',');
  if (order !== ACTS.join(',')) {
    return [`the acts go ${ACTS.join(', ')} in this order, once each (got ${order})`];
  }
  const timing = script.acts.flatMap((a) => (a.end <= a.start ? [`${a.act} ends before it starts`] : []));
  return [...timing, ...script.acts.flatMap((a) => NEEDS[a.act](a, script.research) ?? [])];
}

export function sourcesOf(script: LaunchScript): Source[] {
  const r = script.research;
  return [...r.benefits.map((b) => b.source), ...r.numbers.map((n) => n.source), r.promise.source, ...script.acts.flatMap((a) => a.sources)];
}

const BRAND_NOTE: Record<BrandKind, string[]> = {
  [BrandKind.Real]: [],
  [BrandKind.Fictional]: ['**Fictional brand**: invented name, logo and domain; its claims are the brand\'s own copy, not quotes from a site.', '']
};

export function briefOf(script: LaunchScript): string {
  const r = script.research;
  const cite = (s: Source) => `"${s.quote}" (${s.url})`;
  return [
    ...BRAND_NOTE[script.brand],
    '**Research**',
    `- For: ${r.audience}`,
    `- Problem: ${r.problem}`,
    `- The struggle: ${r.struggle}`,
    `- How it works: ${r.flow.join(' → ')}`,
    ...r.benefits.map((b) => `- Benefit: ${b.claim}, from ${cite(b.source)}`),
    ...r.numbers.map((n) => `- Number: ${n.value}, from ${cite(n.source)}`),
    `- Tone: ${r.tone}`,
    `- Promise: ${cite(r.promise.source)}`,
    '',
    '**Script**',
    ...script.acts.map((a) => `- ${a.start}–${a.end} s, ${a.act}: ${a.scene} On screen: ${a.on_screen.map((t) => `"${t}"`).join(', ')}.${a.ui ? ` UI: ${a.ui}` : ''}`)
  ].join('\n');
}
