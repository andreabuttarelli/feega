import { describe, expect, it } from 'vitest';
import type { Scales } from '@feega/live-edit/theme-scales';
import { Snap, SNAPPABLE, ScaleKind, check, scaleFor, snap, ticksAround } from './snap';

const SCALES: Scales = {
  spacing: [0, 4, 8, 12, 16, 24, 32, 64].map((px) => ({ px, name: String(px / 4) })),
  radius: [
    { px: 0, name: 'none' },
    { px: 4, name: 'sm' },
    { px: 8, name: 'lg' },
    { px: 16, name: '2xl' }
  ],
  fontSize: [
    { px: 12, name: 'xs' },
    { px: 14, name: 'sm' },
    { px: 16, name: 'base' },
    { px: 20, name: 'xl' },
    { px: 24, name: '2xl' }
  ]
};

describe('SNAPPABLE', () => {
  it.each([
    ['padding-top', ScaleKind.Spacing],
    ['padding-all', ScaleKind.Spacing],
    ['margin-x', ScaleKind.Spacing],
    ['gap', ScaleKind.Spacing],
    ['column-gap', ScaleKind.Spacing],
    ['width', ScaleKind.Spacing],
    ['radius', ScaleKind.Radius],
    ['radius-tl', ScaleKind.Radius],
    ['font-size', ScaleKind.FontSize]
  ])('%s snaps to %s', (name, kind) => {
    expect(SNAPPABLE[name]).toBe(kind);
  });

  it('leaves other rows alone', () => {
    expect(scaleFor('opacity', SCALES)).toBeNull();
    expect(scaleFor('line-height', SCALES)).toBeNull();
  });

  it('finds the scale of a row', () => {
    expect(scaleFor('radius', SCALES)).toBe(SCALES.radius);
  });
});

describe('snap', () => {
  it('jumps to a step within 2px', () => {
    expect(snap(17, SCALES.spacing, Snap.On)).toEqual({ px: 16, step: { px: 16, name: '4' } });
  });

  it('jumps to a step within 8 percent of a large value', () => {
    expect(snap(60, SCALES.spacing, Snap.On)).toEqual({ px: 64, step: { px: 64, name: '16' } });
  });

  it('keeps a value farther than both limits', () => {
    expect(snap(20, SCALES.spacing, Snap.On)).toEqual({ px: 20, step: null });
  });

  it('keeps the exact value when snapping is off', () => {
    expect(snap(17, SCALES.spacing, Snap.Off)).toEqual({ px: 17, step: null });
  });

  it('picks the nearer of two steps', () => {
    expect(snap(15.5, SCALES.fontSize, Snap.On).px).toBe(16);
    expect(snap(13.5, SCALES.fontSize, Snap.On).px).toBe(14);
  });

  it('snaps a small value to zero', () => {
    expect(snap(1, SCALES.spacing, Snap.On).px).toBe(0);
  });

  it('leaves a value alone without a scale', () => {
    expect(snap(17, [], Snap.On)).toEqual({ px: 17, step: null });
  });
});

describe('check', () => {
  it('is on theme at a step', () => {
    expect(check(16, SCALES.spacing)).toEqual({ on: true, nearest: { px: 16, name: '4' } });
  });

  it('is off theme between steps and names the nearest', () => {
    expect(check(18, SCALES.spacing)).toEqual({ on: false, nearest: { px: 16, name: '4' } });
  });

  it('tolerates rounding noise', () => {
    expect(check(16.2, SCALES.spacing).on).toBe(true);
  });

  it('has nothing to say without a scale', () => {
    expect(check(18, [])).toEqual({ on: true, nearest: null });
  });
});

describe('ticksAround', () => {
  it('lists steps in the window as offsets from the value', () => {
    expect(ticksAround(16, SCALES.spacing, 10)).toEqual([-8, -4, 0, 8]);
  });

  it('is empty without steps in the window', () => {
    expect(ticksAround(40, SCALES.spacing, 4)).toEqual([]);
  });
});
