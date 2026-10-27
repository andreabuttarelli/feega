import { describe, expect, it } from 'vitest';
import { APNG_MAX_SECONDS, ExportFormat, EXPORT_FORMATS, FORMAT, GIF_LIMITS, GifLoop, Preset, PRESETS, estimateBytes, exportProblem, gifOf, parseSettings, settingsOf } from './export-formats';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { Resolution } from './render-quote';

const doc = (seconds: number, fps = 30) => ({ ...newMotionDoc(MotionFormat.Landscape), fps: fps as 30, durationInFrames: seconds * fps });

describe('export formats', () => {
  it('every format names its file, its type and whether it keeps transparency', () => {
    for (const format of EXPORT_FORMATS) {
      expect(FORMAT[format].ext).toMatch(/^[a-z0-9]+$/);
      expect(FORMAT[format].mime).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
    }
    expect(EXPORT_FORMATS.filter((f) => FORMAT[f].alpha).sort()).toEqual([ExportFormat.Apng, ExportFormat.Gif, ExportFormat.PngSequence, ExportFormat.ProRes4444, ExportFormat.WebmAlpha].sort());
  });

  it('presets cover social, web, gif and a master', () => {
    expect(PRESETS[Preset.Social]).toMatchObject({ format: ExportFormat.Mp4H264, fps: 30 });
    expect(PRESETS[Preset.Web].format).toBe(ExportFormat.WebmAlpha);
    expect(PRESETS[Preset.Gif].format).toBe(ExportFormat.Gif);
    expect(PRESETS[Preset.Master]).toMatchObject({ format: ExportFormat.ProRes4444, resolution: Resolution.P2160 });
    expect(PRESETS[Preset.Social].resolution).toBe(Resolution.P1080);
  });

  it('settings from a form fall back to the social preset and refuse what does not exist', () => {
    expect(parseSettings(null)).toEqual({ ok: true, settings: settingsOf(Preset.Social) });
    expect(parseSettings(JSON.stringify(settingsOf(Preset.Web)))).toEqual({ ok: true, settings: settingsOf(Preset.Web) });
    expect(parseSettings(JSON.stringify({ format: 'avi' })).ok).toBe(false);
    expect(parseSettings(JSON.stringify({ ...PRESETS[Preset.Social], fps: 29 })).ok).toBe(false);
  });

  it('120 fps is an export frame rate', () => {
    expect(parseSettings(JSON.stringify({ ...PRESETS[Preset.Social], fps: 120 })).ok).toBe(true);
  });

  it('a heavier codec makes a bigger file', () => {
    const d = doc(10);

    expect(estimateBytes(d, PRESETS[Preset.Master])).toBeGreaterThan(estimateBytes(d, PRESETS[Preset.Social]));
  });

  it('the size is only known once rendered, so a heavy master is not refused up front', () => {
    expect(exportProblem(doc(60), PRESETS[Preset.Master])).toBeNull();
  });

  it('an output side above 3840 is refused, 4K of every format fits', () => {
    const wide = { ...doc(5), width: 1920, height: 600 };

    expect(exportProblem(wide, { ...settingsOf(Preset.Social), resolution: Resolution.P2160 })).toMatch(/3840/);
    expect(exportProblem({ ...doc(5), width: 1080, height: 1920 }, { ...settingsOf(Preset.Social), resolution: Resolution.P2160 })).toBeNull();
  });

  it('a GIF longer than its cap is refused', () => {
    expect(exportProblem(doc(GIF_LIMITS.maxSeconds + 1), PRESETS[Preset.Gif])).toMatch(/GIF/);
    expect(exportProblem(doc(GIF_LIMITS.maxSeconds), PRESETS[Preset.Gif])).toBeNull();
  });

  it('an APNG longer than its cap is refused, up to it is fine', () => {
    const apng = { ...PRESETS[Preset.Social], format: ExportFormat.Apng };

    expect(exportProblem(doc(APNG_MAX_SECONDS + 1), apng)).toMatch(/APNG/);
    expect(exportProblem(doc(APNG_MAX_SECONDS), apng)).toBeNull();
  });

  it('a GIF loops forever at 15 fps and 640 px unless told otherwise', () => {
    expect(gifOf(PRESETS[Preset.Gif])).toEqual({ loop: GifLoop.Forever, fps: 15, width: 640 });
  });

  it('GIF options are taken within their limits and refused beyond', () => {
    const gif = (options: object) => parseSettings(JSON.stringify({ ...PRESETS[Preset.Gif], gif: options })).ok;

    expect(gif({ loop: GifLoop.Boomerang, fps: 30, width: 1280 })).toBe(true);
    expect(gif({ fps: 31 })).toBe(false);
    expect(gif({ fps: 7 })).toBe(false);
    expect(gif({ width: 1921 })).toBe(false);
    expect(gif({ loop: 'twice' })).toBe(false);
  });

  it('a wider, faster GIF is estimated bigger, and a boomerang twice as long', () => {
    const d = doc(5);
    const base = estimateBytes(d, PRESETS[Preset.Gif]);

    expect(estimateBytes(d, { ...PRESETS[Preset.Gif], gif: { loop: GifLoop.Forever, fps: 30, width: 640 } })).toBeGreaterThan(base);
    expect(estimateBytes(d, { ...PRESETS[Preset.Gif], gif: { loop: GifLoop.Boomerang, fps: 15, width: 640 } })).toBe(base * 2);
  });
});
