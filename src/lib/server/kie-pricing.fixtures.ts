import { pricesOf } from './kie-pricing';

const record = (modelDescription: string, creditPrice: string, creditUnit: string, anchor: string, interfaceType: string) => ({ modelDescription, creditPrice, creditUnit, anchor, interfaceType });

const GROK = 'https://kie.ai/grok-imagine?model=grok-imagine%2Ftext-to-video';

export const KIE_FIXTURE_PRICES = pricesOf([
  record('Google nano banana 2, 1K', '8', 'per image', 'https://kie.ai/nano-banana-2', 'image'),
  record('Google nano banana 2, 2K', '12', 'per image', 'https://kie.ai/nano-banana-2', 'image'),
  record('Google nano banana 2, 4K', '18', 'per image', 'https://kie.ai/nano-banana-2', 'image'),
  record('Google nano banana pro, 1/2K', '18.0', 'per image', 'https://kie.ai/nano-banana-pro', 'image'),
  record('Google nano banana pro, 4K', '24.0', 'per image', 'https://kie.ai/nano-banana-pro', 'image'),
  record('grok-imagine, text-to-video, 480p', '2.4', 'per second', GROK, 'video'),
  record('grok-imagine, text-to-video, 720p', '4.5', 'per second', GROK, 'video'),
  record('grok-imagine, text-to-video, 1080p', '8', 'per second', GROK, 'video'),
  record('Recraft Remove Background, image to image', '1.0', 'per image', 'https://kie.ai/recraft-remove-background', 'image'),
  record('Topaz Image Upscaler, image-upscale, 4K', '20.0', 'per image', 'https://kie.ai/topaz-image-upscale', 'image'),
  record('Topaz Image Upscaler, image-upscale, 2K', '10.0', 'per image', 'https://kie.ai/topaz-image-upscale', 'image'),
  record('seedream 5 Flash, layer-decomposition, 2K', '3.24', 'per image', 'https://kie.ai/seedream-5-0-flash?model=seedream%2F5-flash-layer-decomposition', 'image'),
  record('ideogram v3-edit, image-to-image, QUALITY', '10.0', 'per image', 'https://kie.ai/ideogram/v3?model=ideogram%2Fv3-edit', 'image'),
  record('ideogram v3-edit, image-to-image, BALANCED', '7.0', 'per image', 'https://kie.ai/ideogram/v3?model=ideogram%2Fv3-edit', 'image'),
  record('ideogram v3-edit, image-to-image, TURBO', '3.5', 'per image', 'https://kie.ai/ideogram/v3?model=ideogram%2Fv3-edit', 'image'),
  record('qwen text-to-image', '2', 'per image', 'https://kie.ai/qwen?model=qwen%2Ftext-to-image', 'image'),
  record('qwen3 pro text-to-image', '6.4', 'per image', 'https://kie.ai/qwen3?model=qwen3%2Fpro-text-to-image', 'image'),
  record('acme video, 720p', '3', 'per second', 'https://kie.ai/acme?model=acme%2Ftext-to-video', 'video')
]);
