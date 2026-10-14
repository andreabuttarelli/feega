import { z } from 'zod';
import type { MotionDoc } from '../doc';
import { addClip, addTrack, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { SFX_LIBRARY, ShotSound, cursorCues, type Sfx, type SfxCue } from '../sfx';
import { writeComponent } from '../custom/ops';
import { VECTOR_TOKEN } from '../vector-ui/piece';
import { VectorRole, type VectorNode, type VectorUi } from '../vector-ui/model';
import { Zone, ranked, zoneOf } from '../vector-ui/importance';
import { AUTO_CURSOR, SHOTS, ShotUi, overLimits, shotSource, type ShotId } from './library';
import { cursorMath, type CursorStep, type CursorUi } from './cursor';

const HEX = /^#[0-9a-fA-F]{6}$/;

export const STYLE_SLOTS = z.object({ font: z.string().max(64).optional(), ink: z.string().regex(HEX).optional(), paper: z.string().regex(HEX).optional(), muted: z.string().regex(HEX).optional(), accent: z.string().regex(HEX).optional() });

const BEAT = /^beat \d+$/;
const SNAP_S = 0.3;

export enum ShotFocus {
  Action = 'action',
  Navigation = 'navigation'
}

export type ShotPlan = { shot: ShotId; slots: Record<string, unknown>; ui?: string; at: number; seconds?: number; trackId?: string; sound?: ShotSound; focus?: ShotFocus };

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

const idsIn = (slots: Record<string, unknown>): [string, unknown][] => [
  ...Object.entries(slots).filter(([k]) => ID_SLOT.test(k)),
  ...((slots.cursor as CursorStep[] | undefined) ?? []).map((step): [string, unknown] => ['cursor', step.target])
];

function missingIds(slots: Record<string, unknown>, nodes: readonly VectorNode[]): string | null {
  const known = new Set(nodes.map((n) => n.id));
  const missing = idsIn(slots).filter(([, v]) => typeof v === 'string' && !known.has(v));
  if (!missing.length) {
    return null;
  }
  const offer = nodes.filter((n) => n.role !== 'box').slice(0, 40).map((n) => `${n.id}${n.text ? ` "${n.text.slice(0, 24)}"` : ''}`);
  return `${missing.map(([k, v]) => `${k} ${String(v)}`).join(', ')} not in the UI; its elements: ${offer.join(', ')}`;
}

const TOP_OFFERED = 8;

function onNavigation(slots: Record<string, unknown>, ui: VectorUi, focus: ShotFocus): string | null {
  if (focus === ShotFocus.Navigation) {
    return null;
  }
  const nav = idsIn(slots).flatMap(([, v]) => ui.nodes.filter((n) => n.id === v && zoneOf(ui, n) === Zone.Nav)).map((n) => `${n.id}${n.text ? ` "${n.text.slice(0, 24)}"` : ''}`);
  if (!nav.length) {
    return null;
  }
  const top = ranked(ui).filter((e) => e.zone === Zone.Main).slice(0, TOP_OFFERED).map((e) => `${e.id}${e.text ? ` "${e.text.slice(0, 24)}"` : ''}`);
  return `${[...new Set(nav)].join(', ')} ${nav.length > 1 ? 'are' : 'is'} navigation (sidebar, top bar): a shot frames the action, not the menu. Use the top elements: ${top.join(', ')}. Only when the script line is about navigating pass focus "navigation"`;
}

const SLOT_ROLES: Record<string, readonly VectorRole[]> = {
  field_id: [VectorRole.Input],
  button_id: [VectorRole.Button, VectorRole.Link, VectorRole.Icon]
};

function wrongRoles(slots: Record<string, unknown>, ui: string, nodes: readonly VectorNode[]): string | null {
  for (const [slot, roles] of Object.entries(SLOT_ROLES)) {
    const node = nodes.find((n) => n.id === slots[slot]);
    if (!node || roles.includes(node.role)) {
      continue;
    }
    const fitting = nodes.filter((n) => roles.includes(n.role)).slice(0, 20).map((n) => `${n.id}${n.text ? ` "${n.text.slice(0, 24)}"` : ''}`);
    if (!fitting.length) {
      return `${ui} has no ${roles.join(' or ')} for ${slot}: recreate_ui the app screen where the work happens (its prompt, form or editor), signed in with app_browse, and use that UI`;
    }
    return `${slot} ${node.id} is a ${node.role}, not a ${roles.join(' or ')}: pick one of ${fitting.join(', ')}`;
  }
  return null;
}

export const cursorUiOf = (ui: VectorUi): CursorUi => {
  const byId = new Map(ui.nodes.map((n) => [n.id, n]));
  return { width: ui.width, height: ui.height, box: (id) => {
    const n = byId.get(id);
    return n ? { x: n.x, y: n.y, w: Math.max(1, n.w), h: Math.max(1, n.h), role: n.role } : null;
  } };
};

export function shotCursor(shot: ShotId, slots: Record<string, unknown>, ui: VectorUi): CursorStep[] | null {
  const given = slots.cursor as CursorStep[] | undefined;
  if (given?.length) {
    return given;
  }
  const make = AUTO_CURSOR[shot];
  return make ? make(slots, (entries) => cursorMath().auto(entries, cursorUiOf(ui)) as CursorStep[]) : null;
}

export const shotComponent = (shot: ShotId, ui?: string) => `${SHOTS[shot].name}${ui ?? ''}`;

function asProps(doc: MotionDoc, name: string, slots: Record<string, unknown>): Record<string, unknown> {
  const schema = doc.components[name]?.propsSchema.properties ?? {};
  return Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, schema[k]?.type === 'string' && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v]));
}

const SFX_TRACK = 'SFX';
const SFX_VOLUME = 0.6;

export function placeSfx(doc: MotionDoc, cues: readonly SfxCue[], assets: Partial<Record<Sfx, string>>, newId: () => string): OpResult {
  const existing = doc.tracks.find((t) => t.kind === TrackKind.Audio && t.name === SFX_TRACK);
  const trackId = existing?.id ?? newId();
  let result: OpResult = existing ? { ok: true, doc } : addTrack(doc, TrackKind.Audio, trackId, SFX_TRACK);
  for (const cue of cues) {
    const assetId = assets[cue.sfx];
    if (!result.ok || !assetId) {
      continue;
    }
    const frames = Math.max(1, Math.round(SFX_LIBRARY[cue.sfx].seconds * result.doc.fps));
    result = addClip(result.doc, { component: 'Audio', from: Math.round(cue.at * result.doc.fps), durationInFrames: frames, trackId, props: { assetId, volume: SFX_VOLUME } }, newId());
  }
  return result;
}

const SOUNDS: Record<ShotSound, (steps: Parameters<typeof cursorCues>[0]) => SfxCue[]> = {
  [ShotSound.Off]: () => [],
  [ShotSound.On]: cursorCues
};

const optional = (v: unknown) => (v as z.ZodType).isOptional();

const slotList = (slots: z.ZodObject<z.ZodRawShape>) =>
  [...Object.entries(slots.shape).map(([k, v]) => `${k}${optional(v) ? '' : ' (required)'}`), ...Object.keys(STYLE_SLOTS.shape)].join(', ');

function slotProblems(slots: z.ZodObject<z.ZodRawShape>, given: Record<string, unknown>): string {
  const known = new Set([...Object.keys(slots.shape), ...Object.keys(STYLE_SLOTS.shape)]);
  const unknown = Object.keys(given).filter((k) => !known.has(k)).map((k) => `${k} is not a slot`);
  const missing = Object.entries(slots.shape).filter(([k, v]) => !optional(v) && given[k] === undefined).map(([k]) => `${k} is required`);
  const parsed = slots.extend(STYLE_SLOTS.shape).safeParse(given);
  const typed = parsed.success ? [] : parsed.error.issues.filter((i) => given[String(i.path[0])] !== undefined).map((i) => `${i.path.join('.')} ${i.message}`);
  return [...unknown, ...missing, ...typed].join('; ');
}

export function addShot(doc: MotionDoc, plan: ShotPlan, id: string): OpResult & { placed?: Placed; cues?: SfxCue[] } {
  const spec = SHOTS[plan.shot];
  const parsed = spec.slots.extend(STYLE_SLOTS.shape).strict().safeParse(plan.slots);
  if (!parsed.success) {
    return { ok: false, error: `${plan.shot} slots: ${slotProblems(spec.slots, plan.slots)} (its slots: ${slotList(spec.slots)})` };
  }
  const seconds = plan.seconds ?? spec.seconds.best;
  if (seconds < spec.seconds.min || seconds > spec.seconds.max) {
    return { ok: false, error: `${plan.shot} lasts ${spec.seconds.min}–${spec.seconds.max} s: pass seconds ${spec.seconds.min}–${spec.seconds.max}, best ${spec.seconds.best}, or leave it out; never stretch a shot to fit words, cut the words` };
  }
  const crowded = overLimits(plan.shot, parsed.data);
  if (crowded) {
    return { ok: false, error: crowded };
  }
  const vector = plan.ui ? vectorOf(doc, plan.ui) : null;
  if (spec.ui === ShotUi.Required && !vector) {
    return { ok: false, error: `${plan.shot} shows the real product UI: pass ui, the name of a UI rebuilt with recreate_ui from a url${plan.ui ? ` (${plan.ui} is not one)` : ''}` };
  }
  const wrong = vector ? (missingIds(parsed.data, vector.nodes) ?? wrongRoles(parsed.data, plan.ui ?? '', vector.nodes) ?? onNavigation(parsed.data, vector, plan.focus ?? ShotFocus.Action)) : null;
  if (wrong) {
    return { ok: false, error: wrong };
  }
  const name = shotComponent(plan.shot, spec.ui === ShotUi.Required ? plan.ui : undefined);
  const written = doc.components[name] ? { ok: true as const, doc } : writeComponent(doc, name, { source: shotSource(plan.shot, vector), propsSchema: { type: 'object', properties: {} } });
  if (!written.ok) {
    return written;
  }
  const script = vector ? shotCursor(plan.shot, parsed.data, vector) : null;
  const slots = script ? { ...parsed.data, cursor: script } : parsed.data;
  const placed = onBeat(written.doc, Math.round(plan.at * doc.fps), Math.round(seconds * doc.fps), spec.seconds);
  const made = addClip(written.doc, { component: 'Custom', from: placed.from, durationInFrames: placed.frames, trackId: plan.trackId, props: { name, ...asProps(written.doc, name, slots) } }, id);
  if (!made.ok) {
    return made;
  }
  const steps = script && vector ? cursorMath().plan(script, cursorUiOf(vector), placed.frames / doc.fps).steps : [];
  const cues = SOUNDS[plan.sound ?? ShotSound.Off](steps).map((c) => ({ ...c, at: c.at + placed.from / doc.fps }));
  return { ...made, placed, cues };
}
