// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { framePicker } from './frame-pick';
import { PICK_FIXTURES } from './frame-pick-fixtures';
import recorded from './frame-pick-outlines.json';

const GRID = 16;
const TILE = { x: 500, y: -200 };
const SUBPIXEL = 0.5;

const outlinesBefore: Record<string, Record<string, number[] | null>> = recorded;

function survey(name: string) {
  const { doc, playhead, turn = 0 } = PICK_FIXTURES[name]();
  const picker = framePicker({ doc, tokens: FEEGA_TOKENS, assets: {} }, () => playhead);
  const size = picker.frameSize();
  const space = picker.spaceOf({ ...TILE, w: size.width, h: size.height }, turn);
  const points = Array.from({ length: GRID * GRID }, (_, i) => ({ x: TILE.x + ((i % GRID) + 0.5) * (size.width / GRID), y: TILE.y + (Math.floor(i / GRID) + 0.5) * (size.height / GRID) }));
  const picks = points.map((w) => `${Math.round(w.x)},${Math.round(w.y)} pick=${picker.pick(w, space)} chain=${picker.chain(w, space).join('>')} stack=${picker.stack(w, space).join(',')}`);
  const ids = [...new Set([...Object.keys(picker.leafRects()), ...doc.tracks.flatMap((t) => t.clips.map((c) => c.id))])].sort();
  const outlines = Object.fromEntries(ids.map((id) => [id, picker.outlineQuad(id, space)?.flatMap((p) => [p.x, p.y]) ?? null]));
  return { size, picks, outlines };
}

describe('the frame picker finds what the HTML picker it replaced found', () => {
  it.each(Object.keys(PICK_FIXTURES))('%s: the same picks, stacks and chains', (name) => {
    const { size, picks } = survey(name);

    expect({ size, picks }).toMatchSnapshot();
  });

  it.each(Object.keys(PICK_FIXTURES))('%s: the same outlines, to the subpixel', (name) => {
    const { outlines } = survey(name);
    const before = outlinesBefore[name];

    expect(Object.keys(outlines)).toEqual(Object.keys(before));
    for (const [id, corners] of Object.entries(outlines)) {
      const off = corners && before[id] ? Math.max(...corners.map((v, i) => Math.abs(v - before[id]![i]))) : corners === before[id] ? 0 : Infinity;
      expect(off, id).toBeLessThan(SUBPIXEL);
    }
  });
});
