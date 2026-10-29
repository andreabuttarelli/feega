import { genNodeSize, type GenMedium, type ModelChoice } from './gen-node';
import type { FilledNodeDrag } from './drag-payload';

export type HotMedium = Extract<GenMedium, 'image' | 'video' | 'model3d'>;

export type HotModel = { medium: HotMedium; id: string; label: string; logo: string };

export const HOT_MODELS: readonly HotModel[] = [
  { medium: 'image', id: 'wiro/google/nano-banana-2-1', label: 'Nano Banana 2.1', logo: 'google' },
  { medium: 'image', id: 'nano-banana-2', label: 'Nano Banana 2', logo: 'google' },
  { medium: 'image', id: 'gpt-image-2', label: 'GPT Image 2', logo: 'openai' },
  { medium: 'image', id: 'seedream-5-pro', label: 'Seedream 5 Pro', logo: 'bytedance' },
  { medium: 'video', id: 'bytedance/seedance-2-5', label: 'Seedance 2.5', logo: 'bytedance' },
  { medium: 'video', id: 'kling-3.0/video', label: 'Kling 3.0', logo: 'kuaishou' },
  { medium: 'video', id: 'wiro/google/veo3-1', label: 'Veo 3.1', logo: 'google' },
  { medium: 'model3d', id: 'wiro/microsoft/trellis-2', label: 'Trellis 2', logo: 'microsoft' },
  { medium: 'model3d', id: 'wiro/tencent/hunyuan3d-2-1', label: 'Hunyuan3D 2.1', logo: 'tencent' }
];

export function hotTiles(choicesFor: (medium: HotMedium) => ModelChoice[]): HotModel[] {
  return HOT_MODELS.filter((hot) => choicesFor(hot.medium).some((c) => c.id === hot.id));
}

export function hotDrag(hot: HotModel): FilledNodeDrag {
  return { type: hot.medium, data: { prompt: '', model: hot.id, params: {}, refId: null }, ...genNodeSize(hot.medium) };
}
