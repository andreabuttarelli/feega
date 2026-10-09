import { COMPONENTS, HEADLINE_SIZE, TITLE_LOOK, TITLE_RANGE, TrackKind } from './components';
import { STORY_BEATS, STORY_SHARE, storyBeats } from './story';
import type { MotionDoc } from './doc';
import { EffectKind } from './effects/registry';
import { JunctionKind } from './junction-model';
import { TransitionKind } from './design';
import { EASE_BEZIER, easeCurve, type Bezier, type Keyframe } from './keyframes';
import { motionEngine } from './engine/engine';
import { loopSeam, tooDense } from './ui-morph/ops';
import { uiOverload } from './ui-focus';
import { DEFAULT_STYLE, MotionStyle, STYLE_EASES, type StyleEases } from './style-model';

export enum Forbidden {
  Particles = 'particles',
  Glow = 'glow',
  Rotation = 'rotation',
  Bounce = 'bounce',
  FlyingText = 'flying-text',
  Crowded = 'crowded',
  Transition = 'transition',
  Still = 'still',
  OffBeat = 'off-beat',
  NoPeak = 'no-peak',
  RoughCut = 'rough-cut',
  ReadingTime = 'reading-time',
  Screenshots = 'screenshots',
  MissingStoryBeat = 'missing-story-beat',
  Rushed = 'rushed',
  LoopSeam = 'loop-seam',
  TooDense = 'too-dense',
  TextOverScene = 'text-over-scene',
  TooMuchText = 'too-much-text',
  WeakEase = 'weak-ease',
  UiOverload = 'ui-overload',
  TitleType = 'title-type'
}

export enum Script {
  Required = 'required',
  Free = 'free'
}

export type StyleSpec = {
  label: string;
  script: Script;
  eases: StyleEases;
  seconds: { enter: [min: number, max: number]; stagger: number; exit: number; still: number; scene: [min: number, max: number] };
  movement: { rise: number; settle: number; blur: number; pushIn: number; turn: number };
  type: { family: string; weights: { display: number; text: number }; sizes: { hero: number; line: number; small: number } };
  palette: { ink: string; paper: string; muted: string; accents: number };
  junctions: readonly JunctionKind[];
  entrances: readonly TransitionKind[];
  reading: { perWord: number; base: number; phrase: number; pause: number };
  forbidden: readonly Forbidden[];
  pace: { minGap: number; hold: number };
  maxMoving: number;
  rules: readonly string[];
};

const TEXT = new Set(['Title', 'Text', 'Kicker', 'Caption']);
const ROTATIONS = ['rotateX', 'rotateY', 'rotateZ', 'rotation', 'skewX', 'skewY'];
const POSITIONS = ['x', 'y'];
const SPIN_LIMIT = 60;
const OVERSHOOT_Y = 1;
const PICTURES = new Set(['Image', 'Device3D']);
const DRIFTS = ['scale', 'scaleX', 'scaleY', 'x', 'y', 'z', 'zoom', 'dolly', 'orbit', 'focusX', 'focusY', 'objectRotateX', 'objectRotateY', 'objectRotateZ', 'screenScroll'];
const DRIFT_STEP = 0.004;
const DEVICE_TURN = { start: -20, end: 40 };
const BEAT_LABEL = /^beat \d+$/;
const BEAT_TOLERANCE_FRAMES = 2;
const PEAK_FROM_S = 6;
const PEAK_TRAVEL: Record<string, number> = { scale: 0.6, zoom: 0.8, dolly: 0.5, objectRotateX: 90, objectRotateY: 90, objectRotateZ: 90 };
const HARD_CUT_SHARE = 0.25;
const ENTRY_FRAMES = 2;
const READING = { perWord: 0.4, base: 0.6, phrase: 1.2, pause: 1 };
const MAIN_PICTURE_AREA = 0.25;
const BACKDROP_BLUR = 8;
const BACKDROP_OPACITY = 0.35;
const SHOWN_PICTURE: readonly [component: string, prop: string][] = [
  ['Image', 'assetId'],
  ['Device3D', 'screen']
];
const HEADLINES = new Set(['Title', 'Text', 'Kicker']);
const SCENES = new Set(['Custom', 'Device3D', 'Video', 'Model3D']);
const SHARED_SECONDS = 0.5;
const MAX_WORDS_PER_SECOND = 1;
const TITLE_CARDS: readonly Forbidden[] = [Forbidden.TextOverScene, Forbidden.TooMuchText, Forbidden.TitleType];
const CALM: readonly Forbidden[] = [Forbidden.WeakEase, Forbidden.Particles, Forbidden.Glow, Forbidden.Rotation, Forbidden.Bounce, Forbidden.FlyingText, Forbidden.Crowded, Forbidden.Transition, Forbidden.Still];

export const TITLE_CARD_RULE =
  'Little text, and a title owns the frame: most of the video is scenes (rebuilt UI, devices, the product). When words appear they are a title card: big, centred, alone on the frame, nothing competing; the scene it announces comes after. Alternate title card → scene → title card → scene, each its own row in the storyboard. Never lay a headline over a UI, device or picture: only short labels that belong to the rebuilt UI itself. The gate names a headline over a scene and a video carried by text (more than one word per second).';

export const TITLE_TYPE_RULE =
  'Titles are semibold or medium with very tight tracking: every Title, and every Text at headline size, takes weight 600 (500 at most for a softer line), never bold or black (700–900) and never light, and tracking -0.05 (between -0.04 and -0.06, letter-spacing in em). Both are the default when left out; body copy and labels inside the UI keep their own. The title-type gate names a headline outside them.';

export const UI_FOCUS_RULE =
  'One part of the UI at a time, as with words: a product act is a sequence of UI beats, each showing one element (or two that belong together) large in the frame, faithful to the real product UI, then moving on to the next. Example, a prompt being typed: zoom on the text field and the typed text → the button being pressed → the progress bar alone → the result. Build each beat with focus_ui on the anchors add_ui and recreate_ui return (isolate on: the part alone, masked, its box framed on the house ease); pass from beat to beat with a zoom or a shared-element morph (the same element changing size and place), never a cut to a new full screen. The whole screen appears at most briefly, as an establishing shot or at the end; never a busy dashboard held on screen. The ui-overload gate names a whole UI held more than 1.5 s and more than two UI pieces on screen at once.';

export const GRAPHIC_REFERENCE_RULE =
  'References lead: when the user gives or you viewed reference images, copy their composition and type scale, not only their colours: how big the largest type is relative to the frame and whether it bleeds off the edge, the grid and its rules, the columns of small text, where the blocks of colour sit, the ratio of big to small. In view_frames put each frame next to the reference it follows and fix the biggest difference first.';

export const EASING_RULE =
  'Easing is strongly accentuated, with a soft settle: every entrance on enter (feega.out), every exit on exit (feega.in), every move on standard (feega.inOut, the default), an expo-like curve that lands with an almost imperceptible resistance (at most 1–2% past the mark, never a visible bounce). In code, tween with ease: \'feega.out\' / \'feega.inOut\' / \'feega.in\'; springs stay near critical damping. Linear only for a continuous drift, a loop or a driver tween; never sine, power1 or a plain ease; never bouncy or elastic (back, elastic, bounce, overshoot). The weak-ease gate names the rest.';

export const STYLES: Record<MotionStyle, StyleSpec> = {
  [MotionStyle.LaunchFilm]: {
    label: 'Launch film',
    script: Script.Required,
    eases: STYLE_EASES[MotionStyle.LaunchFilm],
    seconds: { enter: [0.2, 0.35], stagger: 0.06, exit: 0.2, still: 0.5, scene: [2, 5] },
    movement: { rise: 0.12, settle: 0.7, blur: 18, pushIn: 1.25, turn: 100 },
    type: { family: 'Inter', weights: { display: 600, text: 500 }, sizes: { hero: 0.26, line: 0.12, small: 0.026 } },
    palette: { ink: '#050505', paper: '#ffffff', muted: '#8b8b8b', accents: 1 },
    junctions: [JunctionKind.Crossfade, JunctionKind.DipToBlack, JunctionKind.Blur, JunctionKind.Zoom, JunctionKind.PushLeft, JunctionKind.PushRight, JunctionKind.Wipe],
    entrances: [TransitionKind.None, TransitionKind.Fade, TransitionKind.Blur, TransitionKind.Scale, TransitionKind.SlideLeft, TransitionKind.SlideRight, TransitionKind.SlideUp],
    reading: READING,
    forbidden: [Forbidden.Particles, Forbidden.Glow, Forbidden.Bounce, Forbidden.WeakEase, Forbidden.Crowded, Forbidden.Transition, Forbidden.Still, Forbidden.OffBeat, Forbidden.NoPeak, Forbidden.RoughCut, Forbidden.ReadingTime, Forbidden.Screenshots, Forbidden.MissingStoryBeat, Forbidden.Rushed, Forbidden.UiOverload, ...TITLE_CARDS],
    pace: { minGap: 0.25, hold: 0.5 },
    maxMoving: 4,
    rules: [
      'Launch film is the house style: the LOOK of an Apple keynote film, Linear, Vercel Ship or Stripe Sessions (few elements, very large type, the real product, a sober palette) with HIGH ENERGY. Minimal never means slow: the bar is "would a client pay for this?". Never a slideshow, a still picture, a slow fade, the same layout twice or a PowerPoint effect.',
      TITLE_CARD_RULE,
      TITLE_TYPE_RULE,
      UI_FOCUS_RULE,
      EASING_RULE,
      'Story first: four acts, problem (the user\'s pain in the brand\'s own words), solution (the product enters), proof (features shown live, numbers, results), claim (promise, original logo, address), about 20/15/45/20% of the length, each marked with mark_story; the gate names a missing act.',
      'Storyboard first: before the first edit write a table, one row per scene, grouped by act: time, beat, scene template, the line it says, the move (kinetic type, speed ramp, device fly, match cut, montage, peak, logo build).',
      'Music is always there and drives the cut: with no audio in the project call add_music first (mood and bpm that fit the brand; it lays the track and marks its beats), otherwise put the project music on an Audio clip, analyze_audio, mark_beats; then cut on the beat, never on a half beat (cut_to_beat). A scene lasts until every animation in it has finished, plus a 1–1.5 s hold; never cut while something is still moving. Longer beats compressed: fewer ideas, never faster cuts (3 to 5 scenes in 15 s). Backgrounds never show a cut-off or banded gradient.',
      'Build from the launch scenes: list_templates, insert_template builtin:launch-* (word-burst, ui-speed-ramp, device-fly, number-match-cut, ui-tilt-zoom, beat-montage, ui-explode, device-orbit, logo-build) and fill them with set_template_fields; push them further with keyframes. builtin:scene-* are the calm variants, for a beat of rest.',
      'Kinetic type that can be read: words land on the beat, very large, each punching in from 130–140% and an 18 px blur in 0.2–0.3 s on enter (feega.out), then STAY: every text is on screen at least 0.4 s per word plus 0.6 s, 1.2 s at least for a phrase, plus a 1 s pause once read (the gate names unreadable text). Build a line word by word and hold it; energy comes from movement and transitions, never from text that disappears. One accent colour on the key word.',
      'Camera never rests: every picture pushes, zooms inside its box (Image zoom with focus_x/focus_y) or pans; devices fly in turning 90° or more and keep drifting; nothing holds still for more than half a second (the quality gate names it). A drift is slow (a few % of scale, a few % of the frame or about 10° per second) or longer than 2 s: it is camera, it never needs a hold and never blocks a cut; anything faster is an animation that must finish and hold.',
      'Speed ramps: a zoom into the real UI runs slow-fast-slow on standard (feega.inOut): hold a beat, whip to the detail on the next beat, keep creeping. Motion blur on (set_motion_blur, 180°, 6 samples) so the whip smears.',
      'Match cuts: carry a word, a number or the product across the cut in the same place (the hook word becomes the headline on the real page; three numbers swap in one spot).',
      'One clear wow peak on the strongest beat, about two thirds in: the UI exploding into 3D (launch-ui-explode), a white flash on the drop, the biggest move of the film. The gate names a film with no peak.',
      'Every junction flows: a match cut (an element carries on into the next scene), camera continuity (a zoom that goes through and becomes the next scene: set_clip_transition zoom), a whip pan with motion blur (push-left/push-right), a soft wipe, a dissolve with movement, a shape or UI morphing into the next. A hard cut is the exception, a deliberate hit on a strong beat, and rare: the gate names a film cut together hard.',
      'A memorable close built by its context, never by the logo: light, a shockwave, the address and the claim around the logo (launch-logo-build).',
      'A real brand logo is always the original asset (the SVG or PNG from the site or the brand kit), flat and intact, on a Logo or Image clip: never Logo3D, extrusion, chrome, recolouring, deformation, filters, blends, masks or reveals that cut it. It may only fade in or scale in a little, whole.',
      'Recreate the product, never as screenshots: for a SaaS or an app, add_ui rebuilds its UI live in the brand style (font, colours and corner radius from analyze_site): a link typed and shortened, a list filling, numbers counting, a chart drawing, a funnel filling, a table updating, a QR building, inside vector browser or phone chrome. In the storyboard, every act names the UI it recreates: a kit piece (add_ui) when one fits the product, otherwise recreate_ui on the site capture (or a region of it) to rebuild that screen as vector UI with its real texts; captures are raw material for recreate_ui, not footage. The camera follows the action by moving the clip position onto the part that moves, with scale changes within about 10% on a smooth ease: never pump the scale, never push UI or text out of the frame (the gate names anything outside the safe area). Screenshots are raw material, never content: not even for a moment may a sharp screenshot fill the frame or a device screen. At most a background (blur 8 or more, or opacity 0.35 or less); the gate names every sharp one and blocks delivery.',
      'Palette: near-black background, white type, one accent from the brand. Forbidden: decorative particles, glows, bounce or overshoot, more than four things moving at once.',
      'Meaning before motion: the film tells the saved script (write_script). The problem is a recognisable moment of the user\'s day shown on a "before" screen with real-looking data; the solution is the product doing its real flow with specific content; the proof is a number or result the site states; the claim is the site\'s promise. Never an empty or generic UI (the empty-ui gate blocks it).',
      'UI morph language in every product scene: springs for every reaction (press, hover, toggle, tab), one UI morphing into the next instead of exit and entrance, content swapping with a short blur and stagger, the camera framing the active state, cursor clicks and drags only on anchors through click_ui, clean flat graphics. ui_morph_reel when the beat is a sequence of interface states.'
    ]
  },
  [MotionStyle.AppleMinimal]: {
    label: 'Apple minimal',
    script: Script.Free,
    eases: STYLE_EASES[MotionStyle.AppleMinimal],
    seconds: { enter: [0.3, 0.5], stagger: 0.1, exit: 0.4, still: 1, scene: [2, 4] },
    movement: { rise: 0.02, settle: 0.97, blur: 6, pushIn: 1.05, turn: 14 },
    type: { family: 'Inter', weights: { display: 600, text: 400 }, sizes: { hero: 0.15, line: 0.075, small: 0.026 } },
    palette: { ink: '#000000', paper: '#ffffff', muted: '#86868b', accents: 1 },
    junctions: [JunctionKind.Crossfade, JunctionKind.DipToBlack, JunctionKind.Blur],
    entrances: [TransitionKind.None, TransitionKind.Fade, TransitionKind.Blur],
    reading: READING,
    forbidden: [...CALM, Forbidden.ReadingTime, Forbidden.UiOverload, ...TITLE_CARDS],
    pace: { minGap: 1, hold: 1 },
    maxMoving: 2,
    rules: [
      'Apple minimal is the house style: every frame should look like a frame of an Apple keynote or product film. Confident and calm: type snaps in and holds, the camera drifts slowly, one idea at a time.',
      TITLE_CARD_RULE,
      TITLE_TYPE_RULE,
      UI_FOCUS_RULE,
      EASING_RULE,
      'Build the video from the scene library: list_templates, then insert_template the builtin:scene-* scenes one after another and fill them with set_template_fields (real text, brand pictures, the one accent colour). Build primitives by hand only for something no scene can show.',
      'Storyboard first: before the first edit, write the plan as a short table, one row per scene: time, scene template, the line it says, the beat it lands on.',
      'One idea per scene, 2–4 s each. Type is either very large (one line that fills the frame) or very small; nothing in between. Lots of empty space.',
      'Palette: black or white background, the text white or near-black, one accent from the brand used on one word or one number at a time. Never more than one accent colour.',
      'Text enters fast and decisive, then holds still: 0.3–0.5 s on enter (feega.out), a 2% rise and a light blur per line, each line a clip staggered 0.05–0.15 s after the one before. Never a slow 1 s text fade.',
      'Slow movement belongs to the camera and the product only: a push-in or pan that runs the whole time a picture is on screen, linear. No picture or device may stand still for more than 1 s: the quality gate names it.',
      'Product reveal and UI close-up scenes always drift: a slow push-in plus a small pan. When the project has AI video clips made from the product photos, use them instead of the still photo.',
      'Never zoom a picture past its real resolution: the largest scale is source pixels / pixels on screen. For UI use import_asset with capture desktop or mobile (sharp 2× screenshots of the page and its sections), never og:image or a small site thumbnail; the quality gate names a soft picture.',
      'A phone screen wants a mobile capture, a laptop or browser a desktop one: a desktop screenshot on a phone loses its sides.',
      'Between scenes: a cut on the beat, a dissolve (set_clip_transition crossfade or dip-to-black) or a match cut (the next scene keeps the word or object in the same place). Never wipes, pushes, zooms or spins.',
      'Forbidden by default: decorative particles, glows, gratuitous rotation, bounce or overshoot, text that flies across the frame, physics, more than two things moving at once. The quality gate in view_frames names each one.',
      'Show the product, big: at least half the scenes carry a picture of it (scene-ui-closeup on a detail, scene-device-hero, scene-product-reveal, scene-media-caption). Never the same scene or the same crop twice; with a single picture, vary it: a close-up on one detail, the whole on a device, then a scene with a line under it.',
      'Screenshots must be readable: frame the part that matters with zoom inside the box and focus_x/focus_y (product reveal and ui-closeup); never a whole page shrunk small.',
      'Sound: when the project has music, put it on an Audio clip and cut the scenes on its beats (analyze_audio, cut_to_beat).',
      'Every text stays on screen long enough to be read: 0.4 s per word plus 0.6 s, 1.2 s at least for a phrase.',
      'A real brand logo is always the original asset, flat and intact (Logo or Image clip): never extruded, recoloured, filtered or deformed; a fade or a small scale only.'
    ]
  },
  [MotionStyle.UiMorph]: {
    label: 'UI morph reel',
    script: Script.Free,
    eases: STYLE_EASES[MotionStyle.UiMorph],
    seconds: { enter: [0.2, 0.35], stagger: 0.05, exit: 0.15, still: 0.5, scene: [0.5, 2] },
    movement: { rise: 0, settle: 1, blur: 12, pushIn: 1, turn: 0 },
    type: { family: 'Geist', weights: { display: 600, text: 500 }, sizes: { hero: 0.05, line: 0.03, small: 0.02 } },
    palette: { ink: '#0a0a0a', paper: '#ffffff', muted: '#e7e4de', accents: 1 },
    junctions: [],
    entrances: [TransitionKind.None],
    reading: READING,
    forbidden: [Forbidden.Particles, Forbidden.Glow, Forbidden.Bounce, Forbidden.WeakEase, Forbidden.LoopSeam, Forbidden.TooDense],
    pace: { minGap: 0.9, hold: 0.6 },
    maxMoving: 2,
    rules: [
      EASING_RULE,
      UI_FOCUS_RULE,
      'One shape, never a cut: every UI state is the same element morphing size, radius and colour on springs while its content swaps with a short blur (ui_morph_reel builds it).',
      'A cursor drives every change with real clicks and drags; while a knob is held its value comes from the pointer, on release it springs from where it is.',
      'Warm light grey canvas, black and white components and at most one accent; a clean UI font (Geist); no gradients, glows, particles or bouncy eases.',
      'Calm, never dense: one change every two beats or every bar from a downbeat, then a hold (at least 0.6 s) in which the state reads; energy comes from the quality of the movement, not from the number of events. 8 states over a longer loop beat 11 rushed ones. The cursor moves slowly on curves. The too-dense gate names events closer than 0.9 s.',
      'Analyze the music with mark_beats and set the reel offset to the first beat.',
      'The last frame flows into the first, cursor included: the reel spans the whole video and the loop-seam gate names anything that breaks the loop.'
    ]
  },
  [MotionStyle.Graphic]: {
    label: 'Graphic poster',
    script: Script.Free,
    eases: STYLE_EASES[MotionStyle.Graphic],
    seconds: { enter: [0.2, 0.4], stagger: 0.06, exit: 0.2, still: 1, scene: [2, 4] },
    movement: { rise: 0.08, settle: 0.8, blur: 8, pushIn: 1.1, turn: 90 },
    type: { family: 'Inter Tight', weights: { display: 700, text: 500 }, sizes: { hero: 0.5, line: 0.12, small: 0.018 } },
    palette: { ink: '#0a0a0a', paper: '#f2f0eb', muted: '#8b8b8b', accents: 1 },
    junctions: [JunctionKind.Crossfade, JunctionKind.Wipe, JunctionKind.PushLeft, JunctionKind.PushRight],
    entrances: [TransitionKind.None, TransitionKind.Fade, TransitionKind.SlideLeft, TransitionKind.SlideRight, TransitionKind.SlideUp],
    reading: READING,
    forbidden: [Forbidden.Particles, Forbidden.Glow, Forbidden.Bounce, Forbidden.WeakEase, Forbidden.Crowded, Forbidden.ReadingTime],
    pace: { minGap: 0.5, hold: 0.6 },
    maxMoving: 3,
    rules: [
      'Graphic poster is for a look, poster or type exercise with no product to sell (Swiss, brutalist, editorial, a moodboard): every frame is a printed poster that moves. No script and no story acts: the references and the brief are the whole direction.',
      GRAPHIC_REFERENCE_RULE,
      'Type is the image: one word or number so large it bleeds off one or two edges (Title or Text 0.4–1.2 of the frame, x or y partly outside), set against small text (0.015–0.025) in narrow columns, captions and numbers on the grid. Mix weights and widths as the references do; never everything in one size. Pick the face the references show with set_font, any Google family: a condensed or heavy grotesk (Archivo Narrow, Archivo Black, Anton, Oswald, Bebas Neue) for the giant word, a neo-grotesk (Inter Tight, Space Grotesk) for the small text.',
      'A visible grid: thin rules (add_shape lines 2–6 px) on a column grid, blocks of flat colour aligned to it, text hung on its lines, generous margins only where the references keep them.',
      EASING_RULE,
      'Movement is graphic: blocks wipe in along the grid, giant type slides across the frame or is revealed by a mask, rules draw on; cut on the beat when there is music. Each layout holds long enough to read as a poster (1 s at least).'
    ]
  }
};

export function styleOf(doc: Pick<MotionDoc, 'style'>): MotionStyle {
  return doc.style ?? DEFAULT_STYLE;
}

type Clip = MotionDoc['tracks'][number]['clips'][number];
type Found = { clip?: Clip; at: number; detail: string };
type ClipCheck = (clips: readonly Clip[], spec: StyleSpec, fps: number) => Found[];
type Check = (doc: MotionDoc, spec: StyleSpec) => Found[];

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

function drifting(track: readonly Keyframe[]): [number, number][] {
  return track.slice(1).flatMap((k, i) => (Math.abs(Number(k.value) - Number(track[i].value)) > DRIFT_STEP ? [[track[i].frame, k.frame] as [number, number]] : []));
}

function turns(clip: Clip): boolean {
  const props = clip.props as Record<string, unknown>;
  const at = (key: string, fallback: number) => (typeof props[key] === 'number' ? (props[key] as number) : fallback);
  return clip.component === 'Device3D' && (at('startAngle', DEVICE_TURN.start) !== at('endAngle', DEVICE_TURN.end) || at('orbitSpeed', 0) > 0);
}

function longestStill(clip: Clip): { at: number; frames: number } {
  if (!PICTURES.has(clip.component) || turns(clip)) {
    return { at: 0, frames: 0 };
  }
  const spans = DRIFTS.flatMap((key) => drifting(clip.keyframes[key] ?? [])).sort((a, b) => a[0] - b[0]);
  let longest = { at: 0, frames: 0 };
  let cursor = 0;
  for (const [start, end] of [...spans, [clip.durationInFrames, clip.durationInFrames] as [number, number]]) {
    if (start - cursor > longest.frames) {
      longest = { at: cursor, frames: start - cursor };
    }
    cursor = Math.max(cursor, end);
  }
  return longest;
}

const perTimeline =
  (check: ClipCheck): Check =>
  (doc, spec) =>
    timelines(doc).flatMap((clips) => check(clips, spec, doc.fps));

const CLIP_CHECKS: Partial<Record<Forbidden, ClipCheck>> = {
  [Forbidden.ReadingTime]: unreadable,
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
  [Forbidden.Still]: (clips, spec, fps) =>
    clips.flatMap((clip) => {
      const still = longestStill(clip);
      return still.frames > spec.seconds.still * fps ? [{ clip, at: clip.from + still.at, detail: `${clip.id} stands still for ${Math.round((still.frames / fps) * 10) / 10} s: keep a slow push-in or pan running the whole time (at most ${spec.seconds.still} s still)` }] : [];
    }),
  [Forbidden.Transition]: (clips, spec) =>
    clips
      .filter((c) => (c.junction && !spec.junctions.includes(c.junction.kind)) || !spec.entrances.includes(c.transitionIn.kind) || !spec.entrances.includes(c.transitionOut.kind))
      .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} enters or leaves with ${clip.junction?.kind ?? clip.transitionIn.kind}: use a cut, a dissolve (${spec.junctions.join(', ')}) or a match cut` }))
};

const WEAK_BAND = 0.12;
const SETTLE_LIMIT = 0.02;
const CURVE_SAMPLES = 100;
const QUARTERS = [0.25, 0.75];
const MOVE_SECONDS = { min: 0.15, max: 2 };
const DRIFT_SPEED: Record<string, number> = { opacity: 0, x: 0.05, y: 0.05, scale: 0.05, blur: 4 };
const LINEAR_DRIVERS = new Set(['none', 'linear', 'power0']);
const CODED_EASE = /ease:\s*["'`]([^"'`]+)["'`]/g;
const engine = motionEngine({} as Window & Record<string, unknown>);

type Curve = (p: number) => number;

const isWeak = (curve: Curve) => QUARTERS.every((p) => Math.abs(curve(p) - p) < WEAK_BAND);

function isBouncy(curve: Curve): boolean {
  const values = Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) => curve(i / CURVE_SAMPLES));
  return Math.max(...values) > 1 + SETTLE_LIMIT || Math.min(...values) < -SETTLE_LIMIT;
}

function weakMove(clip: Clip, fps: number): Found | null {
  for (const [prop, speed] of Object.entries(DRIFT_SPEED)) {
    const track = clip.keyframes[prop] ?? [];
    for (let i = 1; i < track.length; i++) {
      const [a, b] = [track[i - 1], track[i]];
      const seconds = (b.frame - a.frame) / fps;
      const travel = Math.abs(Number(b.value) - Number(a.value));
      if (seconds < MOVE_SECONDS.min || seconds > MOVE_SECONDS.max || !(travel > 0) || travel / seconds <= speed || !isWeak(easeCurve(a.ease))) {
        continue;
      }
      return { clip, at: clip.from + a.frame, detail: `${clip.id} moves ${prop} on a weak curve (linear or sine-like): use enter for entrances, exit for exits, standard for moves; linear only for a drift or a loop` };
    }
  }
  return null;
}

function weakCode(doc: MotionDoc): Found[] {
  return Object.entries(doc.components).flatMap(([name, component]) =>
    [...component.source.js.matchAll(CODED_EASE)]
      .map((m) => m[1])
      .filter((ease) => !LINEAR_DRIVERS.has(ease) && (isWeak(engine.parseEase(ease)) || isBouncy(engine.parseEase(ease))))
      .map((ease) => ({ at: 0, detail: `${name} tweens on ${ease}: weak or bouncy. Use feega.out for entrances, feega.in for exits, feega.inOut for moves; 'none' only for a drift or a loop` }))
  );
}

const weakEases: Check = (doc) => [...timelines(doc).flatMap((clips) => clips.flatMap((clip) => weakMove(clip, doc.fps) ?? [])), ...weakCode(doc)];

const beatFrames = (doc: MotionDoc) => (doc.markers ?? []).filter((m) => BEAT_LABEL.test(m.label)).map((m) => m.frame);

function offBeat(doc: MotionDoc): Found[] {
  const beats = beatFrames(doc);
  if (beats.length < 2) {
    return [];
  }
  const cuts = timelines(doc)[0].filter((c) => c.from > 0 && COMPONENTS[c.component].track === TrackKind.Visual);
  const missed = cuts.find((c) => Math.min(...beats.map((b) => Math.abs(b - c.from))) > BEAT_TOLERANCE_FRAMES);
  return missed ? [{ clip: missed, at: missed.from, detail: `${missed.id} cuts in off the beat: move it onto a beat (cut_to_beat or move_clip to "beat N")` }] : [];
}

const PEAK_SPANS: readonly { from: string; to: string; size: number }[] = [{ from: 'startAngle', to: 'endAngle', size: 90 }];

const spanned = (clip: Clip) => PEAK_SPANS.some(({ from, to, size }) => Math.abs(Number(clip.props[to] ?? 0) - Number(clip.props[from] ?? 0)) >= size);

const peakOf = (clip: Clip) => spanned(clip) || Object.entries(PEAK_TRAVEL).some(([prop, size]) => travel(clip.keyframes[prop] ?? []) >= size);

function noPeak(doc: MotionDoc): Found[] {
  const clips = timelines(doc).flat();
  const end = Math.max(0, ...timelines(doc)[0].map((c) => c.from + c.durationInFrames));
  if (end < PEAK_FROM_S * doc.fps || clips.some(peakOf)) {
    return [];
  }
  return [{ clip: clips[0], at: 0, detail: 'the film has no peak: give its strongest beat one big move (launch-ui-explode, a device flying in turning 90° or more, a 60% scale punch or a whip zoom into the UI)' }];
}

const entersMoving = (clip: Clip) => Object.values(clip.keyframes).some((track) => track.length > 1 && track[0].frame <= ENTRY_FRAMES && travel(track) > 0);

const BOX = ['x', 'y', 'width', 'height'];

const sameBox = (a: Clip, b: Clip) => a.component === b.component && BOX.every((k) => a.props[k] === b.props[k]);

const matches = (clip: Clip, clips: readonly Clip[]) => clips.some((o) => o.id !== clip.id && o.from + o.durationInFrames === clip.from && sameBox(o, clip));

const flows = (clip: Clip, clips: readonly Clip[]) => Boolean(clip.junction) || clip.transitionIn.kind !== TransitionKind.None || entersMoving(clip) || matches(clip, clips);

function roughCut(doc: MotionDoc): Found[] {
  const clips = timelines(doc)[0];
  const arrivals = clips.filter((c) => c.from > 0 && COMPONENTS[c.component].track === TrackKind.Visual);
  const hard = arrivals.filter((c) => !flows(c, clips));
  if (!arrivals.length || hard.length / arrivals.length <= HARD_CUT_SHARE) {
    return [];
  }
  return [{ clip: hard[0], at: hard[0].from, detail: `${hard.length} of ${arrivals.length} junctions are hard cuts with nothing moving across them (first: ${hard.map((c) => c.id).slice(0, 4).join(', ')}): carry the move across the cut (a match cut, a zoom through, a whip pan, a dissolve with movement); keep hard cuts for rare hits on the beat` }];
}

const words = (clip: Clip) => String(clip.props.text ?? '').split(/\s+/).filter(Boolean).length;

const readingTime = (n: number, spec: StyleSpec) => Math.max(spec.reading.perWord * n + spec.reading.base, n > 1 ? spec.reading.phrase : 0) + spec.reading.pause;

function unreadable(clips: readonly Clip[], spec: StyleSpec, fps: number): Found[] {
  return clips
    .filter((c) => TEXT.has(c.component) && words(c) > 0 && c.durationInFrames / fps < readingTime(words(c), spec) - 1 / fps)
    .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} is on screen ${Math.round((clip.durationInFrames / fps) * 10) / 10} s for ${words(clip)} words: it needs ${Math.round(readingTime(words(clip), spec) * 10) / 10} s to be read. Keep the words on screen (let them build the line and stay) and move the camera instead` }));
}

const area = (clip: Clip) => Number(clip.props.width ?? 1) * Number(clip.props.height ?? 1);

type Placed = { clip: Clip; from: number };

function placed(doc: MotionDoc, tracks: MotionDoc['tracks'], offset: number, seen: ReadonlySet<string>): Placed[] {
  return tracks.flatMap((t) => t.clips as Clip[]).flatMap((clip) => {
    const comp = clip.component === 'Precomp' ? String(clip.props.comp) : '';
    const inner = doc.comps[comp];
    if (!inner || seen.has(comp)) {
      return [{ clip, from: offset + clip.from }];
    }
    return placed(doc, inner.tracks, offset + clip.from, new Set([...seen, comp]));
  });
}

const veiled = (clip: Clip) => Number(clip.transform?.blur ?? 0) >= BACKDROP_BLUR || Number(clip.transform?.opacity ?? 1) <= BACKDROP_OPACITY;

const isScreenshot = (clip: Clip) => SHOWN_PICTURE.some(([component, prop]) => clip.component === component && Boolean(clip.props[prop])) && area(clip) >= MAIN_PICTURE_AREA && !veiled(clip);

function screenshots(doc: MotionDoc): Found[] {
  return placed(doc, doc.tracks, 0, new Set())
    .filter((p) => isScreenshot(p.clip))
    .map(({ clip, from }) => ({ clip, at: from, detail: `${clip.id} shows a sharp screenshot in the foreground at ${Math.round((from / doc.fps) * 100) / 100}s: a product film never shows screenshots as content, not even for a moment. Recreate that UI live with add_ui, or keep the screenshot as a background only (blur ${BACKDROP_BLUR} or more, or opacity ${BACKDROP_OPACITY} or less)` }));
}

function rushed(doc: MotionDoc, spec: StyleSpec): Found[] {
  const [shortest] = spec.seconds.scene;
  return timelines(doc)[0]
    .filter((c) => c.component === 'Precomp' && c.durationInFrames < shortest * doc.fps - 1)
    .map((clip) => ({ clip, at: clip.from, detail: `${clip.id} lasts ${Math.round((clip.durationInFrames / doc.fps) * 10) / 10} s: every scene holds ${shortest}–${spec.seconds.scene[1]} s so it can be read. Hold it longer and cut a scene instead: fewer ideas, never faster cuts` }));
}

function missingStory(doc: MotionDoc): Found[] {
  const told = storyBeats(doc);
  const missing = STORY_BEATS.filter((b) => !told.has(b));
  const end = Math.max(0, ...timelines(doc)[0].map((c) => c.from + c.durationInFrames));
  if (Math.max(end, doc.durationInFrames * Number(told.size > 0)) < PEAK_FROM_S * doc.fps || !missing.length) {
    return [];
  }
  return [{ at: 0, detail: `the story misses ${missing.join(', ')}: a brand or product film tells problem (the user's pain, in the brand's own words), solution (the product enters), proof (key features shown with live UI, numbers, results) and claim (promise, original logo, address), about ${STORY_BEATS.map((b) => `${Math.round(STORY_SHARE[b] * 100)}%`).join(' / ')} of the length; mark each act with mark_story` }];
}

const isHeadline = (clip: Clip) => HEADLINES.has(clip.component) && Number(clip.props.size ?? 0) >= HEADLINE_SIZE;

const isScene = (clip: Clip) => SCENES.has(clip.component) || (clip.component === 'Image' && area(clip) >= MAIN_PICTURE_AREA && !veiled(clip));

const shared = (a: Placed, b: Placed) => Math.min(a.from + a.clip.durationInFrames, b.from + b.clip.durationInFrames) - Math.max(a.from, b.from);

function textOverScene(doc: MotionDoc): Found[] {
  const all = placed(doc, doc.tracks, 0, new Set());
  const scenes = all.filter((p) => isScene(p.clip));
  return all
    .filter((p) => isHeadline(p.clip))
    .flatMap((text) => {
      const under = scenes.find((s) => shared(text, s) > SHARED_SECONDS * doc.fps);
      return under ? [{ clip: text.clip, at: Math.max(text.from, under.from), detail: `${text.clip.id} ("${String(text.clip.props.text ?? '')}") sits over the scene ${under.clip.id}: a title owns the whole frame. Put this line on its own title card before the scene (big, centred, nothing else), then cut to the scene; keep only short labels that belong to the UI inside it` }] : [];
    });
}

const outside = (value: number, [min, max]: readonly [number, number]) => value < min || value > max;

function titleType(doc: MotionDoc): Found[] {
  return placed(doc, doc.tracks, 0, new Set())
    .filter((p) => isHeadline(p.clip))
    .flatMap(({ clip, from }) => {
      const weight = Number(clip.props.weight ?? TITLE_LOOK.weight);
      const tracking = Number(clip.props.tracking ?? TITLE_LOOK.tracking);
      if (!outside(weight, TITLE_RANGE.weight) && !outside(tracking, TITLE_RANGE.tracking)) {
        return [];
      }
      return [{ clip, at: from, detail: `${clip.id} ("${String(clip.props.text ?? '')}") is set at weight ${weight}, tracking ${tracking}: a title is semibold or medium (weight ${TITLE_RANGE.weight.join('–')}) with very tight tracking (${TITLE_RANGE.tracking[1]} to ${TITLE_RANGE.tracking[0]}); set weight ${TITLE_LOOK.weight} and tracking ${TITLE_LOOK.tracking}` }];
    });
}

function tooMuchText(doc: MotionDoc): Found[] {
  const seconds = doc.durationInFrames / doc.fps;
  const total = placed(doc, doc.tracks, 0, new Set())
    .filter((p) => TEXT.has(p.clip.component))
    .reduce((sum, p) => sum + words(p.clip), 0);
  if (seconds < PEAK_FROM_S || total / seconds <= MAX_WORDS_PER_SECOND) {
    return [];
  }
  return [{ at: 0, detail: `${total} words in ${Math.round(seconds)} s: the video is carried by text. Keep it to a few short title cards (at most ${MAX_WORDS_PER_SECOND} word per second of video) and let the scenes, the UI and the product tell the rest` }];
}

const CHECKS: Record<Forbidden, Check> = {
  ...(Object.fromEntries(Object.entries(CLIP_CHECKS).map(([effect, check]) => [effect, perTimeline(check)])) as Record<Forbidden, Check>),
  [Forbidden.OffBeat]: offBeat,
  [Forbidden.NoPeak]: noPeak,
  [Forbidden.RoughCut]: roughCut,
  [Forbidden.Screenshots]: screenshots,
  [Forbidden.MissingStoryBeat]: missingStory,
  [Forbidden.Rushed]: rushed,
  [Forbidden.TextOverScene]: textOverScene,
  [Forbidden.TooMuchText]: tooMuchText,
  [Forbidden.TitleType]: titleType,
  [Forbidden.WeakEase]: weakEases,
  [Forbidden.UiOverload]: uiOverload,
  [Forbidden.TooDense]: (doc, spec) => tooDense(doc, spec.pace.minGap).map((p) => ({ clip: p.clip, at: 0, detail: p.detail })),
  [Forbidden.LoopSeam]: (doc) => loopSeam(doc).map((p) => ({ clip: p.clip, at: doc.durationInFrames - 1, detail: p.detail }))
};

export type StyleProblem = { effect: Forbidden; at: number; detail: string };

export function styleProblems(doc: MotionDoc): StyleProblem[] {
  const spec = STYLES[styleOf(doc)];
  return spec.forbidden.flatMap((effect) => CHECKS[effect](doc, spec).map((f) => ({ effect, at: Math.round((f.at / doc.fps) * 100) / 100, detail: f.detail })));
}
