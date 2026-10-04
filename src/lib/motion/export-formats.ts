import { z } from 'zod';
import { FRAME_RATES, type FrameRate } from './design';
import type { MotionDoc } from './doc';

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
  High = 'high'
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

export const GIF = { fps: 15, maxWidth: 640, maxSeconds: 15 } as const;
export const MAX_EXPORT_BYTES = 50 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;
const BITS_PER_BYTE = 8;

export const settingsSchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  fps: z.literal(FRAME_RATES),
  quality: z.enum([Quality.Standard, Quality.High])
});

export type RenderSettings = z.infer<typeof settingsSchema>;

export const PRESETS: Record<Preset, RenderSettings & { label: string }> = {
  [Preset.Social]: { label: 'Social · MP4 1080p30', format: ExportFormat.Mp4H264, fps: 30, quality: Quality.High },
  [Preset.Master]: { label: 'Master · ProRes 4444', format: ExportFormat.ProRes4444, fps: 30, quality: Quality.High },
  [Preset.Web]: { label: 'Web · transparent WebM', format: ExportFormat.WebmAlpha, fps: 30, quality: Quality.High },
  [Preset.Gif]: { label: 'GIF', format: ExportFormat.Gif, fps: 30, quality: Quality.Standard }
};

export type SettingsVerdict = { ok: true; settings: RenderSettings } | { ok: false; error: string };

export function parseSettings(raw: string | null): SettingsVerdict {
  if (!raw) {
    return { ok: true, settings: settingsOf(Preset.Social) };
  }
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ok: true, settings: parsed.data } : { ok: false, error: 'invalid_settings' };
  } catch {
    return { ok: false, error: 'invalid_settings' };
  }
}

export function settingsOf(preset: Preset): RenderSettings {
  const { format, fps, quality } = PRESETS[preset];
  return { format, fps, quality };
}

function gifSize(doc: Pick<MotionDoc, 'width' | 'height'>): { width: number; height: number } {
  const scale = Math.min(1, GIF.maxWidth / doc.width);
  return { width: doc.width * scale, height: doc.height * scale };
}

export function estimateBytes(doc: Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'>, settings: RenderSettings): number {
  const seconds = doc.durationInFrames / doc.fps;
  const gif = settings.format === ExportFormat.Gif;
  const { width, height } = gif ? gifSize(doc) : doc;
  const frames = seconds * (gif ? GIF.fps : settings.fps);
  return Math.round((width * height * frames * FORMAT[settings.format].bitsPerPixel) / BITS_PER_BYTE);
}

export function exportProblem(doc: Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'>, settings: RenderSettings): string | null {
  const seconds = doc.durationInFrames / doc.fps;
  if (settings.format === ExportFormat.Gif && seconds > GIF.maxSeconds) {
    return `a GIF can be at most ${GIF.maxSeconds} s: shorten the video or pick a video format`;
  }
  return null;
}

export function oversize(bytes: number, format: ExportFormat): string | null {
  if (bytes <= MAX_EXPORT_BYTES) {
    return null;
  }
  const mb = (n: number) => Math.round(n / BYTES_PER_MB);
  return `too_large: ${FORMAT[format].label} of this video is ${mb(bytes)} MB, over the ${mb(MAX_EXPORT_BYTES)} MB a saved file can be. Shorten it or pick MP4. Nothing was charged.`;
}

export type { FrameRate };
