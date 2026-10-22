import { z } from 'zod';
import { FRAME_RATES, type FrameRate } from './design';
import type { MotionDoc } from './doc';
import { Resolution } from './render-quote';
import { MAX_RENDER_SIDE, outputSize } from './export-plan';

export enum ExportFormat {
  Mp4H264 = 'mp4-h264',
  Mp4H265 = 'mp4-h265',
  ProRes422 = 'prores-422hq',
  ProRes4444 = 'prores-4444',
  WebmAlpha = 'webm-alpha',
  PngSequence = 'png-sequence',
  Gif = 'gif'
}

export enum Master {
  H264 = 'h264',
  H265 = 'h265',
  ProRes = 'prores',
  Vp9 = 'vp9'
}

export enum Quality {
  Standard = 'standard',
  High = 'high',
  Max = 'max'
}

export enum Preset {
  Social = 'social',
  Master = 'master',
  Web = 'web',
  Gif = 'gif'
}

type FormatSpec = { label: string; ext: string; mime: string; asset: 'video' | 'image' | 'document'; alpha: boolean; audio: boolean; master: Master; bitsPerPixel: number };

export const FORMAT: Record<ExportFormat, FormatSpec> = {
  [ExportFormat.Mp4H264]: { label: 'MP4 · H.264', ext: 'mp4', mime: 'video/mp4', asset: 'video', alpha: false, audio: true, master: Master.H264, bitsPerPixel: 0.12 },
  [ExportFormat.Mp4H265]: { label: 'MP4 · H.265 (HEVC)', ext: 'mp4', mime: 'video/mp4', asset: 'video', alpha: false, audio: true, master: Master.H265, bitsPerPixel: 0.07 },
  [ExportFormat.ProRes422]: { label: 'ProRes 422 HQ (.mov)', ext: 'mov', mime: 'video/quicktime', asset: 'video', alpha: false, audio: true, master: Master.ProRes, bitsPerPixel: 3.5 },
  [ExportFormat.ProRes4444]: { label: 'ProRes 4444 with alpha (.mov)', ext: 'mov', mime: 'video/quicktime', asset: 'video', alpha: true, audio: true, master: Master.ProRes, bitsPerPixel: 5.3 },
  [ExportFormat.WebmAlpha]: { label: 'WebM · VP9 with alpha', ext: 'webm', mime: 'video/webm', asset: 'video', alpha: true, audio: true, master: Master.Vp9, bitsPerPixel: 0.15 },
  [ExportFormat.PngSequence]: { label: 'PNG sequence (.zip)', ext: 'zip', mime: 'application/zip', asset: 'document', alpha: true, audio: false, master: Master.ProRes, bitsPerPixel: 12 },
  [ExportFormat.Gif]: { label: 'GIF', ext: 'gif', mime: 'image/gif', asset: 'image', alpha: true, audio: false, master: Master.Vp9, bitsPerPixel: 1.5 }
};

export const EXPORT_FORMATS = Object.values(ExportFormat) as [ExportFormat, ...ExportFormat[]];

export const QUALITY_SCALE: Record<Quality, number> = { [Quality.Standard]: 1, [Quality.High]: 2.8, [Quality.Max]: 5 };


export enum GifLoop {
  Forever = 'forever',
  Once = 'once',
  Boomerang = 'boomerang'
}

export const GIF_LIMITS = { minFps: 8, maxFps: 30, minWidth: 64, maxWidth: 1920, maxSeconds: 30 } as const;

export const gifOptionsSchema = z.object({
  loop: z.enum(GifLoop).default(GifLoop.Forever),
  fps: z.number().int().min(GIF_LIMITS.minFps).max(GIF_LIMITS.maxFps).default(15),
  width: z.number().int().min(GIF_LIMITS.minWidth).max(GIF_LIMITS.maxWidth).default(640)
});

export type GifOptions = z.infer<typeof gifOptionsSchema>;

export const gifOf = (settings: { gif?: Partial<GifOptions> }): GifOptions => gifOptionsSchema.parse(settings.gif ?? {});
const BITS_PER_BYTE = 8;

export const settingsSchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  fps: z.literal(FRAME_RATES),
  quality: z.enum(Quality),
  resolution: z.enum(Object.values(Resolution) as [Resolution, ...Resolution[]]).default(Resolution.P1080),
  gif: gifOptionsSchema.optional()
});

export type RenderSettings = z.infer<typeof settingsSchema>;

export const PRESETS: Record<Preset, RenderSettings & { label: string }> = {
  [Preset.Social]: { label: 'Social · MP4 1080p30', format: ExportFormat.Mp4H264, fps: 30, quality: Quality.High, resolution: Resolution.P1080 },
  [Preset.Master]: { label: 'Master · 4K ProRes 4444', format: ExportFormat.ProRes4444, fps: 30, quality: Quality.High, resolution: Resolution.P2160 },
  [Preset.Web]: { label: 'Web · transparent WebM', format: ExportFormat.WebmAlpha, fps: 30, quality: Quality.High, resolution: Resolution.P1080 },
  [Preset.Gif]: { label: 'GIF', format: ExportFormat.Gif, fps: 30, quality: Quality.Standard, resolution: Resolution.P1080 }
};

export type SettingsVerdict = { ok: true; settings: RenderSettings } | { ok: false; error: string };

export function parseSettings(raw: string | null): SettingsVerdict {
  if (!raw) {
    return settingsFrom(undefined);
  }
  try {
    return settingsFrom(JSON.parse(raw));
  } catch {
    return { ok: false, error: 'invalid_settings' };
  }
}

export function settingsFrom(value: unknown): SettingsVerdict {
  if (value === undefined) {
    return { ok: true, settings: settingsOf(Preset.Social) };
  }
  const parsed = settingsSchema.safeParse(value);
  return parsed.success ? { ok: true, settings: parsed.data } : { ok: false, error: 'invalid_settings' };
}

export function settingsOf(preset: Preset): RenderSettings {
  const { format, fps, quality, resolution } = PRESETS[preset];
  return { format, fps, quality, resolution };
}

function gifSize(doc: Pick<MotionDoc, 'width' | 'height'>, width: number): { width: number; height: number } {
  const scale = Math.min(1, width / doc.width);
  return { width: doc.width * scale, height: doc.height * scale };
}

export function estimateBytes(doc: Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'>, settings: RenderSettings): number {
  const seconds = doc.durationInFrames / doc.fps;
  const gif = settings.format === ExportFormat.Gif ? gifOf(settings) : null;
  const { width, height } = gif ? gifSize(doc, gif.width) : outputSize(doc, settings.resolution);
  const frames = gif ? seconds * gif.fps * (gif.loop === GifLoop.Boomerang ? 2 : 1) : seconds * settings.fps;
  return Math.round((width * height * frames * FORMAT[settings.format].bitsPerPixel * QUALITY_SCALE[settings.quality]) / BITS_PER_BYTE);
}

export function exportProblem(doc: Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'>, settings: RenderSettings): string | null {
  const seconds = doc.durationInFrames / doc.fps;
  if (settings.format === ExportFormat.Gif && seconds > GIF_LIMITS.maxSeconds) {
    return `a GIF can be at most ${GIF_LIMITS.maxSeconds} s: shorten the video or pick a video format`;
  }
  const out = outputSize(doc, settings.resolution);
  if (Math.max(out.width, out.height) > MAX_RENDER_SIDE) {
    return `${out.width}×${out.height} is over ${MAX_RENDER_SIDE} px on a side: pick a lower resolution`;
  }
  return null;
}

export type { FrameRate };
