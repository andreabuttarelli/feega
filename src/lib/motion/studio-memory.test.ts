import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { TrackKind } from './components';
import { memoryNote, studioMemory } from './studio-memory';

const clip = (component: string, props: Record<string, unknown>) => ({ id: component, from: 0, durationInFrames: 30, component, props }) as never;

const previous = {
  ...newMotionDoc(MotionFormat.Portrait),
  style: 'apple-minimal',
  referenceLook: { typeScale: 0.4, bleed: false, columns: 2, smallText: 'some', palette: ['#111111', '#5e6ad2'], font: 'grotesk', imagery: 'none' },
  fonts: [{ family: 'Inter Display' }],
  assets: [{ id: 'm1', kind: 'audio', name: 'Pulse 120 BPM' }],
  tracks: [
    { id: 'v', kind: TrackKind.Visual, name: 'V', clips: [clip('Custom', { name: 'ShotKineticTitle' }), clip('Custom', { name: 'ShotFeatureGrid' }), clip('Custom', { name: 'ShotKineticTitle' })] },
    { id: 'a', kind: TrackKind.Audio, name: 'A', clips: [clip('Audio', { asset: 'm1' })] }
  ]
} as never;

describe('studio memory', () => {
  it('keeps what made the last video: style, look, type scale, fonts, shots and music', () => {
    const memory = studioMemory(previous);

    expect(memory).toMatchObject({ style: 'apple-minimal', typeScale: 0.4, palette: ['#111111', '#5e6ad2'], fonts: ['Inter Display'], shots: ['ShotKineticTitle', 'ShotFeatureGrid'], music: ['Pulse 120 BPM'] });
  });

  it('tells the next video to reuse it, so it is not rebuilt from zero', () => {
    const note = memoryNote(studioMemory(previous));

    expect(note).toContain('ShotKineticTitle');
    expect(note).toContain('Pulse 120 BPM');
    expect(note).toContain('#5e6ad2');
  });

  it('a project without a previous video remembers nothing', () => {
    expect(memoryNote(studioMemory(newMotionDoc(MotionFormat.Landscape)))).toBe('');
  });
});
