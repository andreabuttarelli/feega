import { z } from 'zod';

export enum ImageTool {
  RemoveBackground = 'remove_background',
  Upscale = 'upscale',
  SplitLayers = 'split_layers'
}

export const IMAGE_TOOLS_GROUP = 'Image tools';

export const IMAGE_TOOL_MODEL: Readonly<Record<ImageTool, string>> = {
  [ImageTool.RemoveBackground]: 'kie/recraft/remove-background',
  [ImageTool.Upscale]: 'kie/topaz/image-upscale',
  [ImageTool.SplitLayers]: 'kie/seedream/5-flash-layer-decomposition'
};

export const UPSCALE_FACTORS = ['2', '4'] as const;

export const imageToolAskSchema = z.object({
  nodeId: z.string().min(1),
  tool: z.nativeEnum(ImageTool),
  factor: z.enum(UPSCALE_FACTORS).optional()
});

const DEFAULT_UPSCALE_FACTOR = '2';

const TOOL_MODELS: ReadonlySet<string> = new Set(Object.values(IMAGE_TOOL_MODEL));

export function isImageToolModel(model: string | null | undefined): boolean {
  return Boolean(model) && TOOL_MODELS.has(model!);
}

const PARAMS: Record<ImageTool, (factor: string | undefined) => Record<string, string>> = {
  [ImageTool.RemoveBackground]: () => ({}),
  [ImageTool.SplitLayers]: () => ({}),
  [ImageTool.Upscale]: (factor) => ({ upscale_factor: (UPSCALE_FACTORS as readonly string[]).includes(factor ?? '') ? factor! : DEFAULT_UPSCALE_FACTOR })
};

export function imageToolParams(tool: ImageTool, factor: string | undefined): Record<string, string> {
  return PARAMS[tool](factor);
}
