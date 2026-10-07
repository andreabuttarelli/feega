import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { writeComponent } from '../custom/ops';
import { registerFont } from '../fonts/ops';
import type { CatalogueFont } from '../fonts/model';
import { springMath } from '../spring';
import { reelMath, type MorphKind, type ReelPlan } from './reel';
import { seamProblems } from './seam';
import { MotionStyle } from '../style-model';
import { REEL_COMPONENT, REEL_FONT, REEL_PIECE } from './piece';

export type ReelRequest = { states: readonly MorphKind[]; bpm: number; offset: number; pace: number; props: Record<string, string | number> };

const reel = reelMath(springMath());

export const isReel = (clip: Pick<MotionClip, 'component' | 'props'>) => clip.component === 'Custom' && clip.props.name === REEL_COMPONENT;

export function reelPlanOf(doc: Pick<MotionDoc, 'width' | 'height'>, props: Record<string, unknown>): ReelPlan {
  const states = String(props.states).split(',').map((s) => s.trim()).filter(Boolean) as MorphKind[];
  const palette = { ink: String(props.ink), paper: String(props.paper), accent: String(props.accent), mute: String(props.line) };
  return reel.plan({ states, bpm: Number(props.bpm), offset: Number(props.offset), frame: Number(props.frame), palette, beatsPerStep: Number(props.pace) });
}

function withReelComponent(doc: MotionDoc, catalogue: readonly CatalogueFont[]): OpResult {
  const fonted = doc.fonts.some((f) => f.family === REEL_FONT) ? { ok: true as const, doc } : registerFont(doc, REEL_FONT, catalogue);
  if (!fonted.ok || fonted.doc.components[REEL_COMPONENT]) {
    return fonted;
  }
  return writeComponent(fonted.doc, REEL_COMPONENT, { source: { html: REEL_PIECE.html, css: REEL_PIECE.css, js: REEL_PIECE.js }, propsSchema: { type: 'object', properties: {} } });
}

export function addMorphReel(doc: MotionDoc, request: ReelRequest, catalogue: readonly CatalogueFont[], id: string): OpResult {
  const unknown = request.states.filter((s) => !(s in reel.library));
  if (unknown.length || request.states.length < 2) {
    return { ok: false, error: `a reel needs two or more states from ${Object.keys(reel.library).join(', ')}${unknown.length ? `; unknown: ${unknown.join(', ')}` : ''}` };
  }
  const written = withReelComponent(doc, catalogue);
  if (!written.ok) {
    return written;
  }
  const given = { ...request.props, states: request.states.join(','), bpm: request.bpm, offset: request.offset, pace: request.pace };
  const props = { name: REEL_COMPONENT, frame: Math.min(doc.width, doc.height), ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)) };
  const defaults = Object.fromEntries(Object.entries(written.doc.components[REEL_COMPONENT].propsSchema.properties).map(([k, s]) => [k, s.default]));
  const period = reelPlanOf(doc, { ...defaults, ...props }).period;
  const frames = Math.round(period * doc.fps);
  const lengthened = { ...written.doc, durationInFrames: frames, style: MotionStyle.UiMorph };
  return addClip(lengthened, { component: 'Custom', from: 0, durationInFrames: frames, props }, id);
}

export function tooDense(doc: MotionDoc, minGap: number): { clip: MotionClip; detail: string }[] {
  return clipsOf(doc)
    .filter(isReel)
    .flatMap((clip) => {
      const { cues, period } = reelPlanOf(doc, clip.props);
      const gaps = cues.map((t, i) => (cues[(i + 1) % cues.length] - t + period) % period || period);
      const tightest = Math.min(...gaps);
      return tightest + 1e-6 < minGap ? [{ clip, detail: `events ${tightest.toFixed(2)} s apart (at least ${minGap} s): give each state a hold to be read, one change every two beats or every bar` }] : [];
    });
}

export function loopSeam(doc: MotionDoc): { clip: MotionClip; detail: string }[] {
  return clipsOf(doc)
    .filter(isReel)
    .flatMap((clip) => {
      const plan = reelPlanOf(doc, clip.props);
      const span = clip.from === 0 && clip.durationInFrames === doc.durationInFrames && Math.abs(plan.period * doc.fps - doc.durationInFrames) < 0.5 ? [] : [`the reel loops every ${plan.period.toFixed(3)} s but its clip runs ${(clip.durationInFrames / doc.fps).toFixed(3)} s from ${(clip.from / doc.fps).toFixed(2)} s in a ${(doc.durationInFrames / doc.fps).toFixed(3)} s video: the last frame cannot flow into the first`];
      return [...span, ...seamProblems(plan, doc.fps)].map((detail) => ({ clip, detail }));
    });
}
