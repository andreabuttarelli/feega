import { z } from 'zod';
import type { MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { writeComponent } from '../custom/ops';
import { VECTOR_TOKEN } from '../vector-ui/piece';
import type { VectorNode, VectorUi } from '../vector-ui/model';
import { SHOTS, ShotUi, shotSource, type ShotId } from './library';

const HEX = /^#[0-9a-fA-F]{6}$/;

export const STYLE_SLOTS = z.object({ font: z.string().max(64).optional(), ink: z.string().regex(HEX).optional(), paper: z.string().regex(HEX).optional(), muted: z.string().regex(HEX).optional(), accent: z.string().regex(HEX).optional() });

const BEAT = /^beat \d+$/;
const SNAP_S = 0.3;

export type ShotPlan = { shot: ShotId; slots: Record<string, unknown>; ui?: string; at: number; seconds?: number; trackId?: string };

export type Placed = { from: number; frames: number; snapped: boolean };

const beatFrames = (doc: MotionDoc) => (doc.markers ?? []).filter((m) => BEAT.test(m.label)).map((m) => m.frame).sort((a, b) => a - b);

const nearest = (beats: readonly number[], frame: number) => beats.reduce((best, b) => (Math.abs(b - frame) < Math.abs(best - frame) ? b : best), beats[0]);

export function onBeat(doc: MotionDoc, from: number, frames: number, range: { min: number; max: number }): Placed {
  const beats = beatFrames(doc);
  if (!beats.length) {
    return { from, frames, snapped: false };
  }
  const snap = SNAP_S * doc.fps;
  const start = Math.abs(nearest(beats, from) - from) <= snap ? nearest(beats, from) : from;
  const lo = start + Math.round(range.min * doc.fps);
  const hi = start + Math.round(range.max * doc.fps);
  const ends = beats.filter((b) => b >= lo && b <= hi);
  const end = ends.length ? nearest(ends, start + frames) : start + frames;
  return { from: start, frames: end - start, snapped: start !== from || end !== start + frames };
}

export function vectorOf(doc: MotionDoc, name: string): VectorUi | null {
  const js = doc.components[name]?.source.js;
  const found = js ? VECTOR_TOKEN.exec(js) : null;
  return found ? { url: '', title: '', raster: [], ...(JSON.parse(found[1]) as Omit<VectorUi, 'url' | 'title' | 'raster'>) } : null;
}

const ID_SLOT = /_id$/;

function missingIds(slots: Record<string, unknown>, nodes: readonly VectorNode[]): string | null {
  const known = new Set(nodes.map((n) => n.id));
  const missing = Object.entries(slots).filter(([k, v]) => ID_SLOT.test(k) && typeof v === 'string' && !known.has(v));
  if (!missing.length) {
    return null;
  }
  const offer = nodes.filter((n) => n.role !== 'box').slice(0, 40).map((n) => `${n.id}${n.text ? ` "${n.text.slice(0, 24)}"` : ''}`);
  return `${missing.map(([k, v]) => `${k} ${String(v)}`).join(', ')} not in the UI; its elements: ${offer.join(', ')}`;
}

export const shotComponent = (shot: ShotId, ui?: string) => `${SHOTS[shot].name}${ui ?? ''}`;

function asProps(doc: MotionDoc, name: string, slots: Record<string, unknown>): Record<string, unknown> {
  const schema = doc.components[name]?.propsSchema.properties ?? {};
  return Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, schema[k]?.type === 'string' && typeof v === 'number' ? String(v) : v]));
}

export function addShot(doc: MotionDoc, plan: ShotPlan, id: string): OpResult & { placed?: Placed } {
  const spec = SHOTS[plan.shot];
  const parsed = spec.slots.extend(STYLE_SLOTS.shape).strict().safeParse(plan.slots);
  if (!parsed.success) {
    const allowed = [...Object.keys(spec.slots.shape), ...Object.keys(STYLE_SLOTS.shape)];
    return { ok: false, error: `${plan.shot} slots: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'slots'} ${i.message}`).join('; ')} (its slots: ${allowed.join(', ')})` };
  }
  const seconds = plan.seconds ?? spec.seconds.best;
  if (seconds < spec.seconds.min || seconds > spec.seconds.max) {
    return { ok: false, error: `${plan.shot} lasts ${spec.seconds.min}–${spec.seconds.max} s: never stretch a shot to fit words, cut the words` };
  }
  const vector = plan.ui ? vectorOf(doc, plan.ui) : null;
  if (spec.ui === ShotUi.Required && !vector) {
    return { ok: false, error: `${plan.shot} shows the real product UI: pass ui, the name of a UI rebuilt with recreate_ui from a url${plan.ui ? ` (${plan.ui} is not one)` : ''}` };
  }
  const wrong = vector ? missingIds(parsed.data, vector.nodes) : null;
  if (wrong) {
    return { ok: false, error: wrong };
  }
  const name = shotComponent(plan.shot, spec.ui === ShotUi.Required ? plan.ui : undefined);
  const written = doc.components[name] ? { ok: true as const, doc } : writeComponent(doc, name, { source: shotSource(plan.shot, vector), propsSchema: { type: 'object', properties: {} } });
  if (!written.ok) {
    return written;
  }
  const placed = onBeat(written.doc, Math.round(plan.at * doc.fps), Math.round(seconds * doc.fps), spec.seconds);
  const made = addClip(written.doc, { component: 'Custom', from: placed.from, durationInFrames: placed.frames, trackId: plan.trackId, props: { name, ...asProps(written.doc, name, parsed.data) } }, id);
  return made.ok ? { ...made, placed } : made;
}
