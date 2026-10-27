import { z } from 'zod';
import { maskSchema } from '$lib/image-mask';
import { extendSchema } from '$lib/outpaint';
import { aspectSchema } from '$lib/reframe';

export enum ImageTool {
  RemoveBackground = 'remove_background',
  Upscale = 'upscale',
  SplitLayers = 'split_layers',
  Inpaint = 'inpaint',
  Outpaint = 'outpaint',
  Reframe = 'reframe'
}

export const IMAGE_TOOLS_GROUP = 'Image tools';

export const IMAGE_TOOL_MODEL: Readonly<Record<ImageTool, string>> = {
  [ImageTool.RemoveBackground]: 'kie/recraft/remove-background',
  [ImageTool.Upscale]: 'kie/recraft/crisp-upscale',
  [ImageTool.SplitLayers]: 'kie/seedream/5-flash-layer-decomposition',
  [ImageTool.Inpaint]: 'kie/ideogram/v3-edit',
  [ImageTool.Outpaint]: 'kie/ideogram/v3-edit',
  [ImageTool.Reframe]: 'kie/ideogram/v3-edit'
};

export enum MaskPaint {
  White = 'white',
  Black = 'black'
}

export const MASK_PAINT: Readonly<Record<string, MaskPaint>> = {
  'kie/ideogram/v3-edit': MaskPaint.Black
};

export function maskPaintOf(tool: ImageTool): MaskPaint {
  return MASK_PAINT[IMAGE_TOOL_MODEL[tool]] ?? MaskPaint.White;
}

export const UPSCALE_FACTORS = ['2', '4'] as const;

export const UPSCALE_RESULT_FACTOR = '2';

export const RENDERING_SPEEDS = ['TURBO', 'BALANCED', 'QUALITY'] as const;

export const REFRAME_PROMPT = 'Paint new picture content in the masked area: continue the scene beyond the edges of the original photo, extending the background, the subject and its surroundings as they would really look, with the same style, lighting, focus and detail. No bands, no streaks, no mirrored or blurred copies, no flat colour.';

const DEFAULT_RENDERING_SPEED = 'BALANCED';

const NEEDS_NO_PROMPT: ReadonlySet<ImageTool> = new Set([ImageTool.RemoveBackground, ImageTool.Upscale, ImageTool.SplitLayers]);

const askShape = z
  .object({
    nodeId: z.string().min(1).describe('An image node with a result.'),
    tool: z.nativeEnum(ImageTool),
    factor: z.enum(UPSCALE_FACTORS).optional().describe('upscale only, ignored: the upscaler always doubles the size.'),
    prompt: z.string().trim().min(1).max(5000).optional().describe('inpaint: what to paint in the masked area.'),
    extend: extendSchema.optional().describe('outpaint: how far to grow each side, as a fraction (0-1) of the image width (left/right) or height (top/bottom).'),
    aspect: aspectSchema.optional().describe('reframe: the target aspect as w:h (9:16, 1:1, 4:5, 16:9 or custom). The image grows to it and the new area is painted in.'),
    mask: maskSchema.optional().describe('inpaint: the area to repaint, as brush strokes {points:[[x,y]...],width} and/or regions {left,top,width,height}, all fractions 0-1 of the image; width is a fraction of its shorter side.')
  })
  .strict();

type Ask = z.infer<typeof askShape>;

const MISSING: Partial<Record<ImageTool, (ask: Ask) => string | null>> = {
  [ImageTool.Inpaint]: (ask) => (!ask.prompt ? 'prompt' : !ask.mask ? 'mask' : null),
  [ImageTool.Outpaint]: (ask) => (!ask.prompt ? 'prompt' : !ask.extend ? 'extend' : null),
  [ImageTool.Reframe]: (ask) => (!ask.aspect ? 'aspect' : null)
};

export const imageToolAskSchema = askShape.superRefine((ask, context) => {
  const missing = MISSING[ask.tool]?.(ask);
  if (missing) {
    context.addIssue({ code: 'custom', path: [missing], message: `${ask.tool} needs ${missing}` });
  }
});

const TOOL_MODELS: ReadonlySet<string> = new Set(Object.values(IMAGE_TOOL_MODEL));

const PROMPTED_MODELS: ReadonlySet<string> = new Set(Object.entries(IMAGE_TOOL_MODEL).filter(([tool]) => !NEEDS_NO_PROMPT.has(tool as ImageTool)).map(([, model]) => model));

export function isImageToolModel(model: string | null | undefined): boolean {
  return Boolean(model) && TOOL_MODELS.has(model!);
}

export function isPromptlessImageTool(model: string | null | undefined): boolean {
  return isImageToolModel(model) && !PROMPTED_MODELS.has(model!);
}

const PARAMS: Record<ImageTool, () => Record<string, string>> = {
  [ImageTool.RemoveBackground]: () => ({}),
  [ImageTool.SplitLayers]: () => ({}),
  [ImageTool.Inpaint]: () => ({ rendering_speed: DEFAULT_RENDERING_SPEED }),
  [ImageTool.Outpaint]: () => ({ rendering_speed: DEFAULT_RENDERING_SPEED }),
  [ImageTool.Reframe]: () => ({ rendering_speed: DEFAULT_RENDERING_SPEED }),
  [ImageTool.Upscale]: () => ({})
};

export function imageToolParams(tool: ImageTool): Record<string, string> {
  return PARAMS[tool]();
}
