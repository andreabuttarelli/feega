import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionTrack } from './doc';
import { Interp, type Keyframe } from './keyframes';
import { TrackKind } from './components';
import { Ease } from './design';
import { KeyMark, KeyGlyph, ROW_PX, RowKind, keyMark, keyGlyph, layerName, propValue, layerRows, rulerMarks } from './timeline-layers';

const clip = (id: string, over: Partial<MotionClip> = {}): MotionClip => ({ id, component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Better marketing' }, keyframes: {}, ...over }) as MotionClip;
const track = (id: string, clips: MotionClip[]): MotionTrack => ({ id, kind: TrackKind.Visual, name: id, clips }) as MotionTrack;
const key = (frame: number, value = 0, out?: Interp): Keyframe => ({ frame, value, ease: Ease.Standard, out });

describe('timeline layers', () => {
  it('gives every clip its own row under its track, and a folded track only its header', () => {
    const tracks = [track('text', [clip('hook'), clip('kicker')]), track('media', [clip('canvas')])];

    const rows = layerRows(tracks, { folded: ['media'], open: [], lanes: () => [] });

    expect(rows.map((r) => [r.kind, r.id])).toEqual([
      [RowKind.Group, 'text'],
      [RowKind.Layer, 'hook'],
      [RowKind.Layer, 'kicker'],
      [RowKind.Group, 'media']
    ]);
    expect(rows.map((r) => r.top)).toEqual([0, ROW_PX[RowKind.Group], ROW_PX[RowKind.Group] + ROW_PX[RowKind.Layer], ROW_PX[RowKind.Group] + 2 * ROW_PX[RowKind.Layer]]);
  });

  it('a twirled-open layer lists one row per animated property', () => {
    const tracks = [track('text', [clip('hook')])];

    const rows = layerRows(tracks, { folded: [], open: ['hook'], lanes: () => [{ prop: 'opacity', label: 'Opacity' }, { prop: 'y', label: 'Position Y' }] });

    expect(rows.filter((r) => r.kind === RowKind.Property).map((r) => r.id)).toEqual(['hook:opacity', 'hook:y']);
    expect(rows.at(-1)!.top).toBe(ROW_PX[RowKind.Group] + ROW_PX[RowKind.Layer] + ROW_PX[RowKind.Property]);
  });

  it('names a layer by component and id, so eighteen shapes stop being called "Shape"', () => {
    expect(layerName(clip('hook'), {})).toBe('Title · hook');
    expect(layerName(clip('p1', { component: 'Precomp', props: { comp: 'c1' } } as Partial<MotionClip>), { c1: { name: 'Intro' } })).toBe('Intro · p1');
  });

  it('marks a property keyed here, animated elsewhere, or still', () => {
    const keys = [key(0), key(10)];

    expect(keyMark(keys, 10)).toBe(KeyMark.Here);
    expect(keyMark(keys, 5)).toBe(KeyMark.Animated);
    expect(keyMark([], 5)).toBe(KeyMark.None);
  });

  it('reads a property value at the playhead: interpolated numbers, held strings', () => {
    expect(propValue([{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 100, ease: Ease.Linear }], 5)).toBe('50');
    expect(propValue([key(0, 0.125)], 3)).toBe('0.13');
    expect(propValue([{ frame: 0, value: '#ff0000', ease: Ease.Linear }, { frame: 10, value: '#00ff00', ease: Ease.Linear }], 12)).toBe('#00ff00');
  });

  it('draws a keyframe by how it leaves: bezier diamond, hold square, linear circle', () => {
    expect(keyGlyph(key(0))).toBe(KeyGlyph.Diamond);
    expect(keyGlyph(key(0, 0, Interp.Hold))).toBe(KeyGlyph.Square);
    expect(keyGlyph(key(0, 0, Interp.Linear))).toBe(KeyGlyph.Circle);
  });

  it('labels the ruler on round steps: whole seconds when zoomed out, frames when zoomed in', () => {
    const fps = 30;
    const wide = rulerMarks(28 * fps, 1, fps).filter((m) => m.label);
    const close = rulerMarks(2 * fps, 12, fps).filter((m) => m.label);

    expect(wide.slice(0, 3).map((m) => m.label)).toEqual(['00:00', '00:02', '00:04']);
    expect(close.slice(0, 3).map((m) => m.label)).toEqual(['00:00f', '00:05f', '00:10f']);
  });

  it('keeps the ruler on whole frames at any rate', () => {
    expect(rulerMarks(120, 1, 60).every((m) => Number.isInteger(m.frame))).toBe(true);
    expect(rulerMarks(newMotionDoc(MotionFormat.Square).durationInFrames, 4).length).toBeGreaterThan(rulerMarks(newMotionDoc(MotionFormat.Square).durationInFrames, 1).length);
  });
});
