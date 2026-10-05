import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { Device } from './devices';
import { DevicePreset, addDeviceRow, applyDevicePreset } from './device-presets';
import { addClip, type OpResult } from './timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withDevice = (device: Device) => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Device3D', from: 0, durationInFrames: 120, props: { device } }, 'd'));

describe('device presets', () => {
  it('spin-in ends at a three-quarter view', () => {
    const clip = findClip(must(applyDevicePreset(withDevice(Device.PhonePro), 'd', DevicePreset.SpinIn)), 'd')!.clip;
    expect(clip.keyframes.objectRotateY?.at(-1)?.value).toBe(-28);
  });

  it('opens a laptop lid, and refuses it on a phone', () => {
    const laptop = findClip(must(applyDevicePreset(withDevice(Device.LaptopPro), 'd', DevicePreset.LidOpen)), 'd')!.clip;
    expect(laptop.keyframes.lid?.map((k) => k.value)).toEqual([0, 110]);
    expect(applyDevicePreset(withDevice(Device.PhonePro), 'd', DevicePreset.LidOpen).ok).toBe(false);
  });

  it('unfolds a foldable flat, and refuses it on a laptop', () => {
    const foldable = findClip(must(applyDevicePreset(withDevice(Device.Foldable), 'd', DevicePreset.FoldOpen)), 'd')!.clip;
    expect(foldable.keyframes.fold?.map((k) => k.value)).toEqual([0, 180]);
    expect(applyDevicePreset(withDevice(Device.LaptopPro), 'd', DevicePreset.FoldOpen).ok).toBe(false);
  });

  it('screen scroll runs to the end of the clip', () => {
    const clip = findClip(must(applyDevicePreset(withDevice(Device.Tablet), 'd', DevicePreset.ScreenScroll)), 'd')!.clip;
    expect(clip.keyframes.screenScroll?.at(-1)).toMatchObject({ value: 1, frame: 105 });
  });

  it('a row adds three staggered devices that turn at different rates', () => {
    const doc = must(addDeviceRow(newMotionDoc(MotionFormat.Landscape), { device: Device.Phone, screens: ['a'], from: 0, durationInFrames: 150, ids: ['p1', 'p2', 'p3'] }));
    const clips = ['p1', 'p2', 'p3'].map((id) => findClip(doc, id)!.clip);
    expect(clips.map((c) => c.from)).toEqual([0, 8, 16]);
    expect(new Set(clips.map((c) => c.keyframes.objectRotateY?.at(-1)?.value)).size).toBe(3);
  });
});
