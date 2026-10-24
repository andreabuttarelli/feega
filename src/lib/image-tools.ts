import { z } from 'zod';
import { maskSchema } from '$lib/image-mask';

export enum ImageTool {
  RemoveBackground = 'remove_background',
  Upscale = 'upscale',
  SplitLayers = 'split_layers',
  Inpaint = 'inpaint'
}

export const IMAGE_TOOLS_GROUP = 'Image tools';

export const IMAGE_TOOL_MODEL: Readonly<Record<ImageTool, string>> = {
  [ImageTool.RemoveBackground]: 'kie/recraft/remove-background',
  [ImageTool.Upscale]: 'kie/topaz/image-upscale',
  [ImageTool.SplitLayers]: 'kie/seedream/5-flash-layer-decomposition',
  [ImageTool.Inpaint]: 'kie/ideogram/v3-edit'
};

export const UPSCALE_FACTORS = ['2', '4'] as const;

export const RENDERING_SPEEDS = ['TURBO', 'BALANCED', 'QUALITY'] as const;

const DEFAULT_UPSCALE_FACTOR = '2';

const DEFAULT_RENDERING_SPEED = 'BALANCED';

const NEEDS_NO_PROMPT: ReadonlySet<ImageTool> = new Set([ImageTool.RemoveBackground, ImageTool.Upscale, ImageTool.SplitLayers]);

const askShape = z
  .object({
    nodeId: z.string().min(1).describe('An image node with a result.'),
    tool: z.nativeEnum(ImageTool),
    factor: z.enum(UPSCALE_FACTORS).optional().describe('upscale only: 2 or 4 (default 2).'),
    prompt: z.string().trim().min(1).max(5000).optional().describe('inpaint: what to paint in the masked area.'),
    mask: maskSchema.optional().describe('inpaint: the area to repaint, as brush strokes {points:[[x,y]...],width} and/or regions {left,top,width,height}, all fractions 0-1 of the image; width is a fraction of its shorter side.')
  })
  .strict();

type Ask = z.infer<typeof askShape>;

const MISSING: Partial<Record<ImageTool, (ask: Ask) => string | null>> = {
  [ImageTool.Inpaint]: (ask) => (!ask.prompt ? 'prompt' : !ask.mask ? 'mask' : null)
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

const PARAMS: Record<ImageTool, (factor: string | undefined) => Record<string, string>> = {
  [ImageTool.RemoveBackground]: () => ({}),
  [ImageTool.SplitLayers]: () => ({}),
  [ImageTool.Inpaint]: () => ({ rendering_speed: DEFAULT_RENDERING_SPEED }),
  [ImageTool.Upscale]: (factor) => ({ upscale_factor: (UPSCALE_FACTORS as readonly string[]).includes(factor ?? '') ? factor! : DEFAULT_UPSCALE_FACTOR })
};

export function imageToolParams(tool: ImageTool, factor: string | undefined): Record<string, string> {
  return PARAMS[tool](factor);
}
