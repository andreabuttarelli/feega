import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { VideoAudio, type PerSecondCredits } from '$lib/canvas/gen-node';

const CENTS_PER_USD = 100;
const VIDEO_FPS = 24;
const PIXELS_PER_VIDEO_TOKEN = 1024;

const FRAME_PIXELS: Readonly<Record<string, number>> = {
  '480p': 854 * 480,
  '720p': 1280 * 720,
  '1080p': 1920 * 1080
};

type PerSecond = (pricing: Record<string, unknown>, resolution: string, audio: VideoAudio) => number | null;

const num = (value: unknown): number | null => {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) ? n : null;
};

const first = (pricing: Record<string, unknown>, keys: string[], scale = 1): number | null => {
  const hit = keys.map((key) => num(pricing[key])).find((value) => value !== null);
  return hit === undefined || hit === null ? null : hit / scale;
};

const PER_SECOND_RATES: readonly PerSecond[] = [
  (p, res, audio) =>
    first(p, audio === VideoAudio.With
      ? [`duration_seconds_with_audio_${res}`, 'duration_seconds_with_audio', `duration_seconds_${res}`, 'duration_seconds']
      : [`duration_seconds_without_audio_${res}`, 'duration_seconds_without_audio', `duration_seconds_${res}`, 'duration_seconds']),
  (p, res) => first(p, [`cents_per_video_output_second_${res}`, `cents_per_second_output_${res}`, 'cents_per_second_output'], CENTS_PER_USD),
  (p, res, audio) => {
    const perToken = first(p, audio === VideoAudio.With ? [`video_tokens_${res}`, 'video_tokens'] : [`video_tokens_without_audio_${res}`, 'video_tokens_without_audio', `video_tokens_${res}`, 'video_tokens']);
    const pixels = FRAME_PIXELS[res];
    return perToken === null || !pixels ? null : (perToken * pixels * VIDEO_FPS) / PIXELS_PER_VIDEO_TOKEN;
  }
];

export function videoUsdPerSecond(pricing: unknown, resolution: string, audio: VideoAudio): number | null {
  if (!pricing || typeof pricing !== 'object') {
    return null;
  }
  for (const rate of PER_SECOND_RATES) {
    const usd = rate(pricing as Record<string, unknown>, resolution, audio);
    if (usd !== null) {
      return usd;
    }
  }
  return null;
}

function creditsAt(pricing: unknown, resolutions: readonly string[], audio: VideoAudio): Record<string, number> | undefined {
  const entries = resolutions.flatMap((resolution) => {
    const usd = videoUsdPerSecond(pricing, resolution, audio);
    return usd === null ? [] : [[resolution, usd * CREDITS_PER_USD_SUBSCRIPTION_LIST] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function videoPerSecondCredits(pricing: unknown, resolutions: readonly string[]): PerSecondCredits | undefined {
  const withAudio = creditsAt(pricing, resolutions, VideoAudio.With);
  const silent = creditsAt(pricing, resolutions, VideoAudio.Without);
  return withAudio || silent ? { [VideoAudio.With]: withAudio, [VideoAudio.Without]: silent } : undefined;
}
