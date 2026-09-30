import { env } from '$env/dynamic/private';

export type ModelFamily =
  | 'gemini'
  | 'nano-banana'
  | 'gpt-image'
  | 'gemini-tts'
  | 'grok-imagine'
  | 'seedance'
  | 'kling';

const FAMILIES: ModelFamily[] = ['gemini', 'nano-banana', 'gpt-image', 'gemini-tts', 'grok-imagine', 'seedance', 'kling'];

const ENDPOINT = 'openrouter';

export type Route = { family: ModelFamily };

export type Slot = 'text' | 'image' | 'tts' | 'video';

const SLOT_DEFAULT: Record<Slot, Route> = {
  text: { family: 'gemini' },
  image: { family: 'gpt-image' },
  tts: { family: 'gemini-tts' },
  video: { family: 'grok-imagine' }
};

const SLOT_ENV: Record<Slot, string> = {
  text: 'AI_ROUTE_TEXT',
  image: 'AI_ROUTE_IMAGE',
  tts: 'AI_ROUTE_TTS',
  video: 'AI_ROUTE_VIDEO'
};

const RETIRED_LEGACY: Array<[name: string, value: string]> = [
  ['GTM_PROVIDER', 'xiaomi'],
  ['GTM_PROVIDER', 'kie'],
  ['GEMINI_TRANSPORT', 'google'],
  ['GEMINI_TRANSPORT', 'kie'],
  ['IMAGE_PROVIDER', 'gemini'],
  ['TTS_PROVIDER', 'gemini'],
  ['AI_PROVIDER', 'xiaomi']
];

function warnRetiredLegacy(): void {
  for (const [name, dead] of RETIRED_LEGACY) {
    if (env[name]?.trim().toLowerCase() !== dead) {
      continue;
    }
    console.warn(`[AI] ${name}=${dead} nomina un endpoint rimosso: ignorata. Si sceglie con AI_ROUTE_*.`);
  }
}

function parseRoute(raw: string | undefined): Route | null {
  const v = raw?.trim().toLowerCase();
  if (!v) {
    return null;
  }

  const [f, e] = v.split('@');
  const family = FAMILIES.find((x) => x === f);
  if (!family) {
    console.warn(`[AI] rotta sconosciuta "${raw}": famiglie valide ${FAMILIES.join(' | ')}`);
    return null;
  }
  if (e && e !== ENDPOINT) {
    console.warn(`[AI] endpoint sconosciuto "${e}" in "${raw}": resta solo ${ENDPOINT}`);
    return null;
  }
  return { family };
}

export function route(slot: Slot): Route {
  warnRetiredLegacy();
  return parseRoute(env[SLOT_ENV[slot]]) ?? SLOT_DEFAULT[slot];
}

export type VideoJob = 'i2v' | 't2v' | 'upscale';

const VIDEO_DEFAULT: Record<VideoJob, string> = {
  i2v: 'grok-imagine-video-1-5-preview',
  t2v: 'grok-imagine/text-to-video',
  upscale: 'grok-imagine/upscale'
};

const VIDEO_ENV: Record<VideoJob, string> = {
  i2v: 'AI_ROUTE_VIDEO_I2V',
  t2v: 'AI_ROUTE_VIDEO_T2V',
  upscale: 'AI_ROUTE_VIDEO_UPSCALE'
};

export function videoModel(job: VideoJob): string {
  return env[VIDEO_ENV[job]]?.trim() || VIDEO_DEFAULT[job];
}
