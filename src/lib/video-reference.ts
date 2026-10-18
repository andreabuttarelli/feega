import { z } from 'zod';

export const BREAKDOWN_VERSION = 1;

const seconds = z.number().min(0);
const words = z.array(z.string()).default([]);
const note = z.string().default('');

const sceneSchema = z.object({
  start: seconds,
  end: seconds,
  description: note,
  onScreenText: words,
  ui: words,
  camera: note,
  transitionOut: note
});

const breakdownSchema = z.object({
  summary: note,
  durationS: seconds,
  aspectRatio: note,
  voiceover: z.array(z.object({ start: seconds, end: seconds, text: z.string() })).default([]),
  scenes: z.array(sceneSchema).min(1),
  pacing: z.object({ cutsPerMinute: z.number().min(0), rhythm: note }),
  palette: words,
  typography: words,
  music: note
});

export type VideoBreakdown = z.infer<typeof breakdownSchema> & { version: number };

export const BREAKDOWN_PROMPT = [
  'Watch this reference video closely and break it down so a motion designer can make a video like it.',
  'Answer ONLY with one JSON object, no prose, with exactly these fields (times in seconds from the start):',
  '{ "summary": string, "durationS": number, "aspectRatio": string (frame width:height, e.g. "16:9", "9:16", "1:1"),',
  '"voiceover": [{ "start": number, "end": number, "text": string }] (every spoken word, verbatim; [] when silent),',
  '"scenes": [{ "start": number, "end": number, "description": string, "onScreenText": [string] (verbatim), "ui": [string] (interface elements shown: fields, buttons, cards, menus), "camera": string (moves: push, pan, zoom, static), "transitionOut": string (how it leaves: cut, whip pan, fade, morph...) }],',
  '"pacing": { "cutsPerMinute": number, "rhythm": string }, "palette": [string] (hex colours), "typography": [string] (families, weights, case, tracking), "music": string }.',
  'Do not identify real people: describe them only as roles (presenter, user).'
].join('\n');

const FENCE = /^```(?:json)?\s*|\s*```$/g;

export function parseBreakdown(raw: string): VideoBreakdown | null {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim().replace(FENCE, ''));
  } catch {
    return null;
  }
  const parsed = breakdownSchema.safeParse(json);
  return parsed.success ? { version: BREAKDOWN_VERSION, ...parsed.data } : null;
}

const RATIO = /^\s*(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)\s*$/;

export function breakdownSize(b: VideoBreakdown): { width: number; height: number } | null {
  const match = RATIO.exec(b.aspectRatio);
  if (!match) {
    return null;
  }
  const [width, height] = [Number(match[1]), Number(match[2])];
  return width > 0 && height > 0 ? { width, height } : null;
}

const round = (s: number) => Math.round(s * 10) / 10;
const span = (start: number, end: number) => `${round(start)}–${round(end)} s`;

export function sceneLine(scene: VideoBreakdown['scenes'][number], index: number): string {
  const parts = [
    `${index + 1}. ${span(scene.start, scene.end)} (${round(scene.end - scene.start)} s) ${scene.description}`.trimEnd(),
    scene.onScreenText.length ? `Text: ${scene.onScreenText.map((t) => `"${t}"`).join(' | ')}` : '',
    scene.ui.length ? `UI: ${scene.ui.join(', ')}` : '',
    scene.camera ? `Camera: ${scene.camera}` : '',
    scene.transitionOut ? `Transition out: ${scene.transitionOut}` : ''
  ];
  return `  ${parts.filter(Boolean).join('. ')}`;
}

export function breakdownBrief(b: VideoBreakdown): string {
  const voice = b.voiceover.length ? b.voiceover.map((l) => `  ${span(l.start, l.end)} "${l.text}"`) : ['  none'];
  return [
    `Reference video breakdown (${b.aspectRatio ? `${b.aspectRatio}, ` : ''}${round(b.durationS)} s, ${b.scenes.length} scenes, ${b.pacing.cutsPerMinute} cuts/min — ${b.pacing.rhythm}).`,
    b.summary ? `Summary: ${b.summary}` : '',
    'Voice-over:',
    ...voice,
    'Scenes:',
    ...b.scenes.map(sceneLine),
    b.palette.length ? `Palette: ${b.palette.join(', ')}` : '',
    b.typography.length ? `Typography: ${b.typography.join('; ')}` : '',
    b.music ? `Music: ${b.music}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}
