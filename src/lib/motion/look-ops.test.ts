import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, motionDocSchema, newMotionDoc, type DocVerdict, type MotionDoc } from './doc';
import { EnvPreset, LightKind, hdriUrl } from './look';
import { removeLight, setLight, setLightKeyframes, setLook } from './look-ops';

const must = (v: DocVerdict): MotionDoc => {
  if (!v.ok) {
    throw new Error(v.error);
  }
  return v.doc;
};

describe('look', () => {
  it('a new video has no look, and an old one without the field still parses', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    expect(doc.look).toBeNull();
    const { look: _gone, ...old } = doc;
    expect(motionDocSchema.parse(old).look).toBeNull();
  });

  it('adds a light with its kind, edits it, and removes it', () => {
    const lit = must(setLight(newMotionDoc(MotionFormat.Square), 'key', { kind: LightKind.Spot, intensity: 8 }));
    expect(lit.look?.lights).toEqual([expect.objectContaining({ id: 'key', kind: LightKind.Spot, intensity: 8, color: '#ffffff' })]);
    const warm = must(setLight(lit, 'key', { color: '#ffaa66' }));
    expect(warm.look?.lights[0]).toMatchObject({ kind: LightKind.Spot, intensity: 8, color: '#ffaa66' });
    expect(must(removeLight(warm, 'key')).look?.lights).toEqual([]);
  });

  it('refuses a new light without a kind and a value out of range', () => {
    expect(setLight(newMotionDoc(MotionFormat.Square), 'rim', { intensity: 2 }).ok).toBe(false);
    expect(setLight(newMotionDoc(MotionFormat.Square), 'rim', { kind: LightKind.Point, intensity: 999 }).ok).toBe(false);
  });

  it('keyframes a light value, and an empty list removes the lane', () => {
    const lit = must(setLight(newMotionDoc(MotionFormat.Square), 'key', { kind: LightKind.Point }));
    const pulsing = must(setLightKeyframes(lit, 'key', 'intensity', [{ frame: 30, value: 1, ease: Ease.Standard }, { frame: 0, value: 6, ease: Ease.Standard }]));
    expect(pulsing.look?.lights[0].keyframes.intensity?.map((k) => k.frame)).toEqual([0, 30]);
    expect(must(setLightKeyframes(pulsing, 'key', 'intensity', [])).look?.lights[0].keyframes).toEqual({});
  });

  it('environment patches merge, and only file presets have a url', () => {
    const doc = must(setLook(newMotionDoc(MotionFormat.Square), { environment: { preset: EnvPreset.Sunset } }));
    expect(must(setLook(doc, { environment: { intensity: 2 } })).look?.environment).toEqual({ preset: EnvPreset.Sunset, intensity: 2, rotation: 0 });
    expect(hdriUrl(EnvPreset.Room, 'https://oh.feega.app')).toBeNull();
    expect(hdriUrl(EnvPreset.Sunset, 'https://oh.feega.app')).toBe('https://oh.feega.app/motion-env/r181/venice_sunset_256.hdr');
  });
});
