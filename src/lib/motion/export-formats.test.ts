import { describe, expect, it } from 'vitest';
import { ExportFormat, EXPORT_FORMATS, FORMAT, MAX_EXPORT_BYTES, Preset, PRESETS, estimateBytes, exportProblem, oversize, parseSettings, settingsOf } from './export-formats';
import { MotionFormat, newMotionDoc } from './doc';
import { Resolution } from './render-quote';

const doc = (seconds: number, fps = 30) => ({ ...newMotionDoc(MotionFormat.Landscape), fps: fps as 30, durationInFrames: seconds * fps });

describe('export formats', () => {
  it('every format names its file, its type and whether it keeps transparency', () => {
    for (const format of EXPORT_FORMATS) {
      expect(FORMAT[format].ext).toMatch(/^[a-z0-9]+$/);
      expect(FORMAT[format].mime).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
    }
    expect(EXPORT_FORMATS.filter((f) => FORMAT[f].alpha).sort()).toEqual([ExportFormat.Gif, ExportFormat.PngSequence, ExportFormat.ProRes4444, ExportFormat.WebmAlpha].sort());
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

  it('a heavier codec makes a bigger file', () => {
    const d = doc(10);

    expect(estimateBytes(d, PRESETS[Preset.Master])).toBeGreaterThan(estimateBytes(d, PRESETS[Preset.Social]));
  });

  it('the size is only known once rendered: a file over the storage limit says its size and how to fit it', () => {
    expect(oversize(MAX_EXPORT_BYTES, ExportFormat.ProRes4444)).toBeNull();
    expect(oversize(MAX_EXPORT_BYTES + 1, ExportFormat.ProRes4444)).toMatch(/^too_large: ProRes 4444.* is 50 MB, over the 50 MB/);
    expect(exportProblem(doc(60), PRESETS[Preset.Master])).toBeNull();
  });

  it('an output side above 3840 is refused, 4K of every format fits', () => {
    const wide = { ...doc(5), width: 1920, height: 600 };

    expect(exportProblem(wide, { ...settingsOf(Preset.Social), resolution: Resolution.P2160 })).toMatch(/3840/);
    expect(exportProblem({ ...doc(5), width: 1080, height: 1920 }, { ...settingsOf(Preset.Social), resolution: Resolution.P2160 })).toBeNull();
  });

  it('a GIF longer than its cap is refused', () => {
    expect(exportProblem(doc(30), PRESETS[Preset.Gif])).toMatch(/GIF/);
  });
});
