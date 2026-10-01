import { GPT_IMAGE_25_FLARE_MODEL } from '$lib/image-models';
import type { GenMedium, GenNode } from '$lib/canvas/gen-node';

export const EXAMPLE_LABEL = 'Example result';

type DemoMedium = Extract<GenMedium, 'text' | 'image' | 'video'>;

const CHEAPEST_VIDEO_MODEL = 'bytedance/seedance-2-mini';
const SHORTEST_CLIP_S = 4;

export const DEMO_PRESET: Record<DemoMedium, Pick<GenNode, 'prompt'> & Partial<Pick<GenNode, 'model' | 'params'>>> = {
  text: {
    prompt: 'Write one vivid image prompt (max 40 words) for a cosy corner coffee shop on a rainy evening.'
  },
  image: {
    prompt: 'Cinematic, warm light, vertical composition.',
    model: GPT_IMAGE_25_FLARE_MODEL,
    params: { aspectRatio: '9:16' }
  },
  video: {
    prompt: 'Rain falls outside the window, the barista finishes pouring latte art, warm light flickers, slow push-in.',
    model: CHEAPEST_VIDEO_MODEL,
    params: { aspectRatio: '9:16', resolution: '480p', duration: SHORTEST_CLIP_S, audio: false }
  }
};

export type DemoResult = { medium: DemoMedium; text?: string; src?: string };

export const DEMO_RESULT: Record<DemoMedium, DemoResult> = {
  text: {
    medium: 'text',
    text: 'A cosy corner coffee shop on a rainy evening: warm window light spilling onto the wet street, a barista pouring latte art behind the glass, hanging plants, a lone bistro table outside glistening with rain.'
  },
  image: { medium: 'image', src: '/onboarding/example-image.webp' },
  video: { medium: 'video', src: '/onboarding/example-video.mp4' }
};

export function isDemoMedium(medium: string): medium is DemoMedium {
  return Object.hasOwn(DEMO_RESULT, medium);
}

export function exampleFor(row: { type: string; data: Record<string, unknown> }): DemoResult | null {
  if (row.data.example !== true || !isDemoMedium(row.type)) {
    return null;
  }
  return DEMO_RESULT[row.type];
}
