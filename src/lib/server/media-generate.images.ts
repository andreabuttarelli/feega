import { env } from '$env/dynamic/private';
import type { ImagePart } from '$lib/server/image-part';
import { getOrgContext } from '$lib/server/ai-log';
import { NANO_BANANA_2_LITE } from '$lib/server/google-models';
import { defaultImageModel } from '$lib/server/media-generate.image-model';
import { generateImageOnOpenrouterImages } from '$lib/server/openrouter-images-api';
import { googleImageModel, rendersOnImagesApi } from '$lib/image-models';
import { generateImageOnOpenrouter } from '$lib/server/openrouter-image';
import { PHOTO_CRAFT_FLOOR } from '$lib/design/photo-craft';
import { photoModeSpec, type PhotoModeId } from '$lib/design/photo-modes';
import { imageCraftFor } from '$lib/design/image-craft';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

const APPAREL_BRANDING_DIRECTIVE = `APPAREL BRANDING — non-negotiable: never add a logo, label, wordmark, readable brand name, patch or embroidered text to a garment, hat, uniform, accessory or textile unless the original brief explicitly requests that exact mark on that wearable item. A mark that belongs to a machine, tool or equipment may appear only on that machine, tool or equipment, never on a garment, hat, uniform, accessory or textile. Do not invent or move branding between objects.`;

const ASPECT_LABEL: Record<AspectRatio, string> = {
  '1:1': 'Square 1:1',
  '4:5': 'Vertical portrait 4:5',
  '9:16': 'Vertical full-screen 9:16',
  '16:9': 'Landscape 16:9'
};

const HOUSE_LOOK = `IMAGE QUALITY BAR (non-negotiable, applies ON TOP of the requested style):
photographic scenes must read as a real editorial/commercial photograph — believable optics (a real lens, natural depth of field), true-to-life materials and skin, natural colour grading. AVOID every AI/stock cliché: over-saturated HDR glow, waxy plastic skin, 3D-render sheen, impossible reflections, floating objects, warped hands or extra fingers, garbled or invented text, watermark-like artifacts, stiff stock-photo posing, and the generic "object on dark textured stone" backdrop. If the prompt does not explicitly ask for on-image text, render NO text at all.`;

export function scrubPersonAppearance(prompt: string): string {
  let s = String(prompt ?? '');
  if (!s.trim()) return s;
  s = s.replace(
    /\b(?:a|an|the)\s+(?:young|old|middle[- ]aged|attractive|handsome|beautiful|pretty)?\s*(?:looking\s+)?(?:man|woman|boy|girl|guy|lady|gentleman|male|female|gentleman)\b/gi,
    'the person'
  );
  s = s.replace(
    /\b(?:young|old|middle[- ]aged)\s+(?:man|woman|boy|girl|guy|lady|male|female)\b/gi,
    'the person'
  );
  s = s.replace(/\b(?:he|she)\s+is\s+a\s+(?:man|woman|boy|girl|male|female)\b/gi, 'the person');
  s = s.replace(/\b(?:gender(?:ed| presentation)?|biological sex)\s*:\s*\w+\b/gi, '');
  s = s.replace(/\b(?:male|female|masculine|feminine)\s+(?:presenting|presentation|looking|coded)\b/gi, '');
  s = s.replace(/\b(?:as a|portray(?:ing|ed as)?(?: a)?)\s+(?:man|woman|boy|girl|male|female)\b/gi, 'as the person');
  s = s.replace(
    /\b(?:with|featuring|showing)\s+(?:a\s+)?(?:beard|mustache|moustache|stubble|long hair|short hair|bald head|muscular build|athletic build|curvy figure)\b/gi,
    ''
  );
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}

export type RenderImageOpts = {
  referenceImages?: ImagePart[];
  personImages?: ImagePart[];
  userRefImages?: ImagePart[];
  visualStyle?: string;
  referenceMode?: 'product' | 'ui';
  baseImage?: ImagePart;
  refineModel?: string;
  aspectRatio?: AspectRatio;
  resolution?: string;
  model?: string;
  craftFloor?: string;
  shotMode?: PhotoModeId;
  params?: Record<string, unknown>;
};

export function buildImageRequest(imagePrompt: string, opts: RenderImageOpts = {}) {
  const aspectRatio = opts.aspectRatio ?? '1:1';
  const needsFidelity = !!(
    opts.personImages?.length ||
    opts.referenceImages?.length ||
    opts.userRefImages?.length ||
    opts.baseImage
  );
  const imageModel =
    (opts.baseImage ? opts.refineModel : undefined) ??
    opts.model ??
    (needsFidelity ? defaultImageModel() : env.IMAGE_MODEL_NO_REF || defaultImageModel());
  const cleanPrompt = opts.personImages?.length ? scrubPersonAppearance(imagePrompt) : imagePrompt;
  const styleSuffix = opts.visualStyle ? `\n\nVISUAL STYLE to match: ${opts.visualStyle}` : '';
  const baseSuffix = opts.baseImage
    ? '\n\nThe FIRST attached image is the CURRENT image — treat it as the BASE to edit. Apply ONLY the change the prompt asks for and keep everything else (subject, composition, framing, lighting and style) faithful to this base image. Edit it, do not regenerate a different scene from scratch.'
    : '';
  const personSuffix = opts.personImages?.length
    ? '\n\nReference photo(s) of the person are attached: they are the ONLY source of identity. Match their face, gender presentation, approximate age, hair, skin and distinguishing features EXACTLY as shown in the photos — never invent or override appearance from the person\'s name or from any gendered words in the text brief (ignore man/woman/boy/girl/male/female if the text says them). Wardrobe and styling MAY follow the brief. Give them a genuine NATURAL expression and relaxed body language that fit the scene (a real smile, mid-laugh, candid in-between), in natural light with authentic framing — never a stiff stock-photo look.'
    : '';
  const refSuffix = !opts.referenceImages?.length
    ? ''
    : opts.referenceMode === 'ui'
      ? '\n\nThe attached reference is a screenshot of a user interface. Reproduce the on-screen UI faithfully and legibly, then present it inside a realistic context — a laptop or phone screen, a clean browser-window mockup, or held/used by a person in a natural UGC-style scene — restyling only the surrounding environment. Do NOT distort, blur or invent UI elements.'
      : '\n\nThe attached photo IS the real product. Reproduce THIS EXACT product faithfully — identical shape, COLOUR, materials, finish, label/branding, proportions and details. CRITICAL: keep the product\'s real colours exactly as shown in the reference photo; NEVER desaturate, greyscale or recolour it. If the reference shows a SET or MULTIPLE units, depict the set/multiple units, not a single isolated piece. Do NOT redesign, restyle or "improve" the product, and do not swap it for a similar-looking one. Restyle ONLY the scene, background and lighting.';
  const userRefSuffix = opts.userRefImages?.length
    ? '\n\nThe user attached the following image(s) as REFERENCES for this specific edit — use them to guide the change described above: match the look, composition, colours or subject they show, as the feedback implies. Let the user\'s instruction decide exactly what to take from them.'
    : '';
  const craftFloor = opts.craftFloor ?? PHOTO_CRAFT_FLOOR;
  const modeSpec = opts.shotMode ? photoModeSpec(opts.shotMode) : '';
  const modeSuffix = modeSpec ? `\n\n${modeSpec}\n` : '';
  const modelCraft = imageCraftFor(imageModel);
  const modelSuffix = modelCraft ? `\n\n${modelCraft}\n` : '';
  const text = `${cleanPrompt}\n\n${ASPECT_LABEL[aspectRatio]}, high quality, social-media ready. No text overlays unless natural.\n\n${HOUSE_LOOK}\n\n${APPAREL_BRANDING_DIRECTIVE}${craftFloor}${modelSuffix}${modeSuffix}${styleSuffix}${baseSuffix}${personSuffix}${refSuffix}${userRefSuffix}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text }, ...(opts.baseImage ? [opts.baseImage] : []), ...(opts.personImages ?? []), ...(opts.referenceImages ?? []), ...(opts.userRefImages ?? [])];
  return {
    model: imageModel,
    contents: [{ role: 'user' as const, parts }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio, resolution: opts.resolution, params: opts.params }
    }
  };
}

export async function renderPostImage(
  imagePrompt: string,
  opts: RenderImageOpts = {}
): Promise<string | undefined> {
  const gateOrg = getOrgContext();
  if (gateOrg) {
    const { gateOrgCredits } = await import('$lib/server/credits');
    await gateOrgCredits(gateOrg);
  }

  const req = buildImageRequest(imagePrompt, opts);
  const imageModel = req.model;
  if (rendersOnImagesApi(imageModel)) {
    return generateImageOnOpenrouterImages(req, { context: `image:${imageModel}` });
  }

  return generateImageOnOpenrouter(
    { ...req, model: googleImageModel(req.model, NANO_BANANA_2_LITE) },
    { context: `image:${imageModel}` }
  );
}
