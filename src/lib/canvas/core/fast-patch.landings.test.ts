import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { clipsOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare, type DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { moveBy } from '$lib/motion/space';
import { EditMode } from '$lib/motion/edit-mode';
import { estimatedText } from '@feega/motion-core/motion/layout/text-extent';
import { fastPatch } from './fast-patch';

const FIXTURE = process.env.LANDINGS_FEEGA ?? join(homedir(), 'Documents/feega-videos/perf/landings/landings.feega');
const MOVES: [number, number][] = [[12, -7], [1, 0], [0, -10]];
const SAME_PX = 0.01;
const MB = 1 << 20;
const BUFFER_MB = 256;

const docs = (): MotionDoc[] => {
  const canvas = JSON.parse(execFileSync('unzip', ['-p', FIXTURE, 'canvas.json'], { maxBuffer: BUFFER_MB * MB }).toString()) as { heads: Record<string, { doc: MotionDoc }> };
  return Object.values(canvas.heads).map((h) => h.doc);
};

const withClip = (doc: MotionDoc, id: string, change: (c: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.map((c) => (c.id === id ? change(c) : c)) } : t)) });

function alike(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= SAME_PX || (Number.isNaN(a) && Number.isNaN(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => alike(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => alike((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

type Tally = { tried: number; patched: number; mismatched: string[] };

const drawn = (doc: MotionDoc): DisplayList => drawFrame(prepare(doc, FEEGA_TOKENS), 0);

function check(tally: Tally, label: string, list: DisplayList, before: MotionDoc, after: MotionDoc | null) {
  if (!after) {
    return;
  }
  tally.tried++;
  const patched = fastPatch(list, before, after, estimatedText);
  if (!patched) {
    return;
  }
  tally.patched++;
  if (!alike(patched, drawn(after))) {
    tally.mismatched.push(label);
  }
}

const moved = (doc: MotionDoc, id: string, by: [number, number]) => {
  const r = moveBy(doc, [id], 0, by, EditMode.Design);
  return r.ok ? r.doc : null;
};

describe.skipIf(!existsSync(FIXTURE))('fastPatch on every clip of the landings fixture', () => {
  it('draws hide and move exactly as the full build, or declines', () => {
    const hide: Tally = { tried: 0, patched: 0, mismatched: [] };
    const move: Tally = { tried: 0, patched: 0, mismatched: [] };
    for (const doc of docs()) {
      const list = drawn(doc);
      for (const clip of clipsOf(doc).filter((c) => !c.hidden)) {
        check(hide, `hide ${clip.id}`, list, doc, withClip(doc, clip.id, (c) => ({ ...c, hidden: true })));
        MOVES.forEach((by) => check(move, `move ${clip.id} ${by}`, list, doc, moved(doc, clip.id, by)));
      }
    }
    console.log(JSON.stringify({ hide: { ...hide, mismatched: hide.mismatched.length }, move: { ...move, mismatched: move.mismatched.length } }));
    expect([...hide.mismatched, ...move.mismatched].slice(0, 20)).toEqual([]);
  }, 3_600_000);
});
