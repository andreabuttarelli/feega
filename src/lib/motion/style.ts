import { TransitionKind } from './design';
import type { MotionDoc } from './doc';
import { EffectKind } from './effects/registry';
import { JunctionKind } from './junction-model';
import { EASE_BEZIER, type Bezier, type Keyframe } from './keyframes';
import { DEFAULT_STYLE, MotionStyle } from './style-model';

export enum Forbidden {
  Particles = 'particles',
  Glow = 'glow',
  Rotation = 'rotation',
  Bounce = 'bounce',
  FlyingText = 'flying-text',
  Crowded = 'crowded',
  Transition = 'transition'
}

export type StyleSpec = {
  label: string;
  eases: { enter: Bezier; move: Bezier };
  seconds: { enter: [min: number, max: number]; exit: number; scene: [min: number, max: number] };
  movement: { rise: number; settle: number; blur: number; pushIn: number; turn: number };
  type: { family: string; weights: { display: number; text: number }; sizes: { hero: number; line: number; small: number } };
  palette: { ink: string; paper: string; muted: string; accents: number };
  junctions: readonly JunctionKind[];
  entrances: readonly TransitionKind[];
  forbidden: readonly Forbidden[];
  maxMoving: number;
  rules: readonly string[];
};

const TEXT = new Set(['Title', 'Text', 'Kicker', 'Caption']);
const ROTATIONS = ['rotateX', 'rotateY', 'rotateZ', 'rotation', 'skewX', 'skewY'];
const POSITIONS = ['x', 'y'];
const SPIN_LIMIT = 60;
const OVERSHOOT_Y = 1;

export const STYLES: Record<MotionStyle, StyleSpec> = {
  [MotionStyle.AppleMinimal]: {
    label: 'Apple minimal',
    eases: { enter: [0.22, 1, 0.36, 1], move: [0.65, 0, 0.35, 1] },
    seconds: { enter: [0.3, 0.8], exit: 0.3, scene: [1, 2.5] },
    movement: { rise: 0.05, settle: 0.94, blur: 16, pushIn: 1.12, turn: 30 },
    type: { family: 'Inter', weights: { display: 600, text: 400 }, sizes: { hero: 0.15, line: 0.075, small: 0.026 } },
    palette: { ink: '#000000', paper: '#ffffff', muted: '#86868b', accents: 1 },
    junctions: [JunctionKind.Crossfade, JunctionKind.DipToBlack, JunctionKind.Blur, JunctionKind.Zoom],
    entrances: [TransitionKind.None, TransitionKind.Fade, TransitionKind.Blur, TransitionKind.Scale],
    forbidden: Object.values(Forbidden),
    maxMoving: 3,
    rules: [
      'Apple minimal is the house style: the LOOK of an Apple, Linear or Vercel launch film (few elements, very large type, the real product, a sober palette) with HIGH ENERGY. Minimal never means slow or static: the bar is "would a client pay for this?".',
      'Build the video from the scene library: list_templates, then insert_template the builtin:scene-* scenes and fill them with set_template_fields (real text, brand pictures, the one accent colour), then push them harder with keyframes, camera and timing. Build primitives by hand only for something no scene can show.',
      'Storyboard first: before the first edit, write the plan as a short table, one row per scene: time, scene template, the line it says, the beat it lands on, the move.',
      'Rhythm: scenes of 1–2.5 s, a cut on every beat or every second beat of the music. Music is always there: generate_music or the project track, analyze_audio, cut_to_beat.',
      'Kinetic typography: words land one by one on the beat (apply_text_preset word-stagger or blur-up, short 0.3–0.6 s entrances), big type punches in with a scale or a snap; one idea per scene, nothing in between very large and very small.',
      'Camera and depth: every scene moves. Pictures push in or pan, devices fly in and turn in 3D (Device3D with apply_device_preset, apply_camera_preset dolly-in, truck, orbit), set_clip_depth for parallax. No picture holds still for more than a second: no slideshow.',
      'Speed ramps and match cuts: ramp a camera move fast-slow-fast into the cut (set_keyframes, eases cubic-bezier(0.22,1,0.36,1) in and cubic-bezier(0.65,0,0.35,1) on moves), carry a word or the product across a cut in the same place (scene-match-cut), punch in with a zoom junction on a downbeat.',
      'A clear wow peak around two thirds in: the product big in 3D, the biggest move and the strongest beat, then a clean end card with the real website.',
      'Palette: black or white background, the text white or near-black, one accent from the brand on one word or one number at a time. Never more than one accent colour.',
      'Forbidden: decorative particles, glows, spinning text, bounce or overshoot, wipes and pushes, more than three things moving at once. The quality gate in view_frames names each one.',
      'Show the product, big and readable: at least half the scenes carry a real screenshot or picture of it (scene-ui-closeup on a detail, scene-device-hero, scene-product-reveal). Crop screenshots on the part that matters (focus_x, focus_y); never a whole page shrunk small, never the same crop twice.'
    ]
  }
};

export function styleOf(doc: Pick<MotionDoc, 'style'>): MotionStyle {
  return doc.style ?? DEFAULT_STYLE;
}

type Clip = MotionDoc['tracks'][number]['clips'][number];
type Found = { clip: Clip; at: number; detail: string };
type Check = (clips: readonly Clip[], spec: StyleSpec) => Found[];

const timelines = (doc: MotionDoc): Clip[][] => [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].map((tracks) => tracks.flatMap((t) => t.clips as Clip[]));

const curve = (k: Keyframe): Bezier => (typeof k.ease === 'string' ? EASE_BEZIER[k.ease] : k.ease);

const overshoots = (k: Keyframe) => curve(k)[1] > OVERSHOOT_Y || curve(k)[3] > OVERSHOOT_Y;

const travel = (track: readonly Keyframe[]) => {
  const values = track.map((k) => Number(k.value)).filter(Number.isFinite);
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
};

const keyed = (clip: Clip, keys: readonly string[]) => keys.filter((k) => (clip.keyframes[k]?.length ?? 0) > 1);

function moving(clip: Clip): [number, number] | null {
  const frames = Object.values(clip.keyframes).flatMap((track) => (track.length > 1 ? track.map((k) => k.frame) : []));
  return frames.length ? [clip.from + Math.min(...frames), clip.from + Math.max(...frames)] : null;
}

function crowded(clips: readonly Clip[], spec: StyleSpec): Found[] {
  const spans = clips.flatMap((clip) => {
    const span = moving(clip);
    return span ? [{ clip, span }] : [];
  });
  for (const { clip, span } of spans) {
    const together = spans.filter((o) => o.span[0] <= span[0] && o.span[1] > span[0]);
    if (together.length > spec.maxMoving) {
      return [{ clip, at: span[0], detail: `${together.length} elements move at the same time (${together.map((o) => o.clip.id).join(', ')}): at most ${spec.maxMoving}` }];
    }
  }
  return [];
}

const CHECKS: Record<Forbidden, Check> = {
  [Forbidden.Particles]: (clips) => clips.filter((c) => c.component === 'Particles').map((clip) => ({ clip, at: clip.from, detail: `${clip.id} is a particle emitter: decorative particles are off-style` })),
  [Forbidden.Glow]: (clips) => clips.filter((c) => c.effects.some((e) => e.enabled && e.kind === EffectKind.Glow)).map((clip) => ({ clip, at: clip.from, detail: `${clip.id} glows: remove the glow effect` })),
  [Forbidden.Rotation]: (clips) =>
    clips
      .filter((c) => keyed(c, ROTATIONS).length || travel(c.keyframes.objectRotateY ?? []) > SPIN_LIMIT || travel(c.keyframes.objectRotateX ?? []) > SPIN_LIMIT)
      .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} rotates: keep pictures and text square to the frame, a device turns at most a few degrees` })),
  [Forbidden.Bounce]: (clips) =>
    clips
      .filter((c) => c.physics || Object.values(c.keyframes).some((track) => track.some(overshoots)) || c.props.easing === 'overshoot')
      .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} bounces or overshoots: use the decelerating eases, no physics` })),
  [Forbidden.FlyingText]: (clips, spec) =>
    clips
      .filter((c) => TEXT.has(c.component) && (c.textPath || POSITIONS.some((k) => travel(c.keyframes[k] ?? []) > spec.movement.rise * 2)))
      .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} flies across the frame: text rises at most ${Math.round(spec.movement.rise * 100)}% and settles` })),
  [Forbidden.Crowded]: crowded,
  [Forbidden.Transition]: (clips, spec) =>
    clips
      .filter((c) => (c.junction && !spec.junctions.includes(c.junction.kind)) || !spec.entrances.includes(c.transitionIn.kind) || !spec.entrances.includes(c.transitionOut.kind))
      .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} enters or leaves with ${clip.junction?.kind ?? clip.transitionIn.kind}: use a cut, a dissolve (${spec.junctions.join(', ')}) or a match cut` }))
};

export type StyleProblem = { effect: Forbidden; at: number; detail: string };

export function styleProblems(doc: MotionDoc): StyleProblem[] {
  const spec = STYLES[styleOf(doc)];
  return spec.forbidden.flatMap((effect) => timelines(doc).flatMap((clips) => CHECKS[effect](clips, spec)).map((f) => ({ effect, at: Math.round((f.at / doc.fps) * 100) / 100, detail: f.detail })));
}
