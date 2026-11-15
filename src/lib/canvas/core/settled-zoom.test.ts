import { describe, expect, it, vi } from 'vitest';
import { CoreMotion } from '@feega/motion-core/motion/gpu-full/core-web';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { GESTURE_QUIET_MS } from './gesture-quiet';
import { strokeZoomStep } from './label-size';
import { settledZoom } from './settled-zoom';
import { SentParts } from './use-diff';
import { ChromeLayers, overlayOf, type WorldOverlay } from './world-overlay';

const TILES = 200;

const clockAt = (start: number) => {
  let now = start;
  return { now: () => now, pass: (ms: number) => (now += ms) };
};

const THEME = { paper: '#ffffff', line: '#e5e5e5', panel: '#ffffff', ink: '#111111', accent: '#ff6a3d' } as never;

const GLYPHS = { measure: () => 0, path: () => '' } as never;

const world = (strokeZoom: number, zoom: number): WorldOverlay => ({
  curves: [],
  selected: [],
  selectedEdge: null,
  marquee: null,
  guides: [],
  zoom,
  theme: THEME,
  glyphs: GLYPHS,
  peers: [],
  outlines: [],
  ghost: null,
  running: [],
  chrome: Array.from({ length: TILES }, (_, i) => ({ id: `t${i}`, x: i * 300, y: 0, width: 200, height: 120, label: null, icon: null, ring: NodeChrome.Selected, handles: false, ringColor: FEEGA_TOKENS.primary ?? '#ff6a3d', names: false, strokeZoom, radius: 4, layers: ChromeLayers.State }) as never)
});

describe('settledZoom', () => {
  it('holds the zoom step while the camera keeps moving and takes the new one once it rests', () => {
    const clock = clockAt(1000);
    const hold = settledZoom(strokeZoomStep, clock.now, 1);

    clock.pass(16);
    const moving = hold.at(1.2);
    clock.pass(GESTURE_QUIET_MS);
    const rested = hold.at(1.2);

    expect(moving).toBe(strokeZoomStep(1));
    expect(rested).toBe(strokeZoomStep(1.2));
  });

  it('a zoom step mid gesture sends no overlay part and serialises no overlay item', () => {
    const clock = clockAt(1000);
    const hold = settledZoom(strokeZoomStep, clock.now, 1);
    const sent = new SentParts();
    sent.changed(overlayOf(world(hold.at(1), 1)), CoreMotion.Still);
    clock.pass(16);
    const stringify = vi.spyOn(JSON, 'stringify');

    const parts = sent.changed(overlayOf(world(hold.at(1.3), 1.3)), CoreMotion.Gesture);

    const calls = stringify.mock.calls.length;
    stringify.mockRestore();
    expect(parts).toEqual([]);
    expect(calls).toBe(0);
  });
});
