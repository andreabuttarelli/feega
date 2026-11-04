import { describe, expect, it } from 'vitest';
import { FRAME_PRESETS, FramePreset, PRESET_SIZE, presetOf } from './frame-presets';

describe('frame presets', () => {
  it('lists device, paper and social sizes', () => {
    expect(FRAME_PRESETS).toEqual([FramePreset.Phone, FramePreset.Tablet, FramePreset.Desktop, FramePreset.Presentation, FramePreset.Watch, FramePreset.Paper, FramePreset.Social]);
    expect(PRESET_SIZE[FramePreset.Phone]).toEqual({ width: 393, height: 852 });
    expect(PRESET_SIZE[FramePreset.Desktop]).toEqual({ width: 1440, height: 1024 });
  });

  it('a custom size matches no preset', () => {
    expect(presetOf({ width: 500, height: 500 })).toBeNull();
  });
});
