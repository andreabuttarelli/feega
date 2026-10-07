import { describe, expect, it } from 'vitest';
import { BROWSER_RENDER_CREDITS, DEVICE_LIMITS, Device, FarmReason, RenderPlace, deviceOf, renderPlace, type PlaceInput } from './render-place';
import { ExportFormat, Preset, settingsOf } from './export-formats';
import { Resolution } from './render-quote';

const desktop = { mobile: false, memoryGb: 8, cores: 8 };
const iphone = { mobile: true, memoryGb: null, cores: 6 };
const weakAndroid = { mobile: true, memoryGb: 2, cores: 4 };
const encodes = { webCodecs: true, h264: true, h264At720: true, aac: true };

const doc = (seconds: number) => ({ width: 1920, height: 1080, fps: 30 as const, durationInFrames: seconds * 30 });

function input(over: Partial<PlaceInput> = {}): PlaceInput {
  return { doc: doc(10), settings: settingsOf(Preset.Social), capabilities: encodes, device: Device.Desktop, background: false, hasAudio: false, ...over };
}

describe('renderPlace', () => {
  it('il default è il browser, gratis', () => {
    expect(renderPlace(input())).toEqual({ place: RenderPlace.Browser });
    expect(BROWSER_RENDER_CREDITS).toBe(0);
  });

  it('va al farm solo se lo sceglie chi esporta, e lo dice', () => {
    const verdict = renderPlace(input({ background: true }));
    expect(verdict).toMatchObject({ place: RenderPlace.Farm, reason: FarmReason.Background });
    expect(verdict.place === RenderPlace.Farm && verdict.message).toMatch(/close this tab/);
  });

  it.each([ExportFormat.ProRes4444, ExportFormat.ProRes422, ExportFormat.Mp4H265, ExportFormat.WebmAlpha, ExportFormat.Gif, ExportFormat.PngSequence])('%s non si codifica nel browser', (format) => {
    expect(renderPlace(input({ settings: { ...settingsOf(Preset.Social), format } }))).toMatchObject({ reason: FarmReason.Format });
  });

  it('senza WebCodecs H.264 va al farm', () => {
    expect(renderPlace(input({ capabilities: { webCodecs: false, h264: false, h264At720: false, aac: false } }))).toMatchObject({ reason: FarmReason.NoEncoder });
  });

  it('il 1080p su un encoder che regge solo 720p va al farm, il 720p resta nel browser', () => {
    const only720 = { ...encodes, h264: false };
    expect(renderPlace(input({ capabilities: only720 }))).toMatchObject({ reason: FarmReason.Device });
    expect(renderPlace(input({ capabilities: only720, settings: { ...settingsOf(Preset.Social), resolution: Resolution.P720 } }))).toEqual({ place: RenderPlace.Browser });
  });

  it('il 4K va al farm', () => {
    expect(renderPlace(input({ settings: { ...settingsOf(Preset.Social), resolution: Resolution.P2160 } }))).toMatchObject({ reason: FarmReason.Device });
  });

  it('un telefono debole regge 720p e un minuto, oltre va al farm', () => {
    const p720 = { ...settingsOf(Preset.Social), resolution: Resolution.P720 };
    expect(renderPlace(input({ device: Device.WeakMobile, settings: p720, doc: doc(DEVICE_LIMITS[Device.WeakMobile].maxSeconds) }))).toEqual({ place: RenderPlace.Browser });
    expect(renderPlace(input({ device: Device.WeakMobile, settings: p720, doc: doc(DEVICE_LIMITS[Device.WeakMobile].maxSeconds + 1) }))).toMatchObject({ reason: FarmReason.Device });
    expect(renderPlace(input({ device: Device.WeakMobile }))).toMatchObject({ reason: FarmReason.Device });
  });

  it('un video lungo su un telefono va al farm con un messaggio chiaro', () => {
    const verdict = renderPlace(input({ device: Device.Mobile, doc: doc(DEVICE_LIMITS[Device.Mobile].maxSeconds + 1) }));
    expect(verdict).toMatchObject({ place: RenderPlace.Farm, reason: FarmReason.Device });
    expect(verdict.place === RenderPlace.Farm && verdict.message).toMatch(/phone/);
  });

  it('con audio da mixare e niente AAC va al farm; senza audio no', () => {
    const noAac = { ...encodes, aac: false };
    expect(renderPlace(input({ capabilities: noAac, hasAudio: true }))).toMatchObject({ reason: FarmReason.NoAudio });
    expect(renderPlace(input({ capabilities: noAac, hasAudio: false }))).toEqual({ place: RenderPlace.Browser });
  });
});

describe('deviceOf', () => {
  it.each([
    [desktop, Device.Desktop],
    [iphone, Device.Mobile],
    [weakAndroid, Device.WeakMobile],
    [{ mobile: true, memoryGb: 8, cores: 8 }, Device.Mobile]
  ])('%o → %s', (info, device) => {
    expect(deviceOf(info)).toBe(device);
  });
});
