import { beforeEach, describe, expect, it, vi } from 'vitest';
import { faceOf } from '$lib/canvas/gpu/card-face';
import { cardsOnCanvas, type CardTile } from './card-source';
import { PortState, type Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import * as cards from './cards';
import * as shift from './shift-down';

vi.mock('./cards', async (actual) => {
  const real = await actual<typeof import('./cards')>();
  return { ...real, cardItems: vi.fn(real.cardItems) };
});
vi.mock('./shift-down', async (actual) => {
  const real = await actual<typeof import('./shift-down')>();
  return { ...real, shiftDown: vi.fn(real.shiftDown) };
});

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#e5e5e5', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: [[0, 0, text.length * size, 0, text.length * size, size, 0, size]], width: text.length * size, height: size });

const ASSET_TIER_ZOOM = 0.75;
const STEPS = 60;
const NEAREST = 1.2;
const FARTHEST = 0.05;

const tileAt = (zoom: number): CardTile => ({
  id: 'm',
  box: { x: 0, y: 0, w: 240, h: 160 },
  face: faceOf({ id: 'm', kind: 'image' }, { assetId: 'a' }, (id) => `${id}?w=${zoom >= ASSET_TIER_ZOOM ? 1024 : 256}`),
  inputs: [],
  outputs: [{ type: 'text', state: PortState.Quiet }],
  label: 'Image',
  icon: null,
  zoom
});

const sweep = Array.from({ length: STEPS + 1 }, (_, i) => NEAREST * (FARTHEST / NEAREST) ** (i / STEPS));
const zoomOutAndBack = [...sweep, ...[...sweep].reverse(), ...sweep];

describe('expensive card work during a zoom gesture', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds a card body once per asset tier, however many steps and tier flips the gesture crosses', () => {
    const draw = cardsOnCanvas(theme, glyphs);
    zoomOutAndBack.forEach((zoom) => draw(tileAt(zoom)));

    expect(cards.cardItems).toHaveBeenCalledTimes(2);
  });

  it('moves a body down once per label octave and tier, not once per zoom step', () => {
    const draw = cardsOnCanvas(theme, glyphs);
    sweep.forEach((zoom) => draw(tileAt(zoom)));
    const firstPass = vi.mocked(shift.shiftDown).mock.calls.length;
    [...sweep].reverse().forEach((zoom) => draw(tileAt(zoom)));
    sweep.forEach((zoom) => draw(tileAt(zoom)));

    expect(firstPass).toBeLessThan(STEPS / 4);
    expect(vi.mocked(shift.shiftDown).mock.calls.length).toBe(firstPass);
  });
});
