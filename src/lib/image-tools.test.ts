import { describe, expect, it } from 'vitest';
import { IMAGE_TOOL_MODEL, ImageTool, imageToolAskSchema, imageToolParams, isImageToolModel } from './image-tools';
import { promptRequired } from '$lib/canvas/gen-node';

describe('image tools', () => {
  it('names the kie model behind every tool', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.RemoveBackground]).toBe('kie/recraft/remove-background');
    expect(IMAGE_TOOL_MODEL[ImageTool.Upscale]).toBe('kie/topaz/image-upscale');
  });

  it('splits layers on kie seedream and carries no params', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.SplitLayers]).toBe('kie/seedream/5-flash-layer-decomposition');
    expect(imageToolParams(ImageTool.SplitLayers, undefined)).toEqual({});
  });

  it('inpaints on kie ideogram edit, balanced by default, and still wants a prompt', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.Inpaint]).toBe('kie/ideogram/v3-edit');
    expect(imageToolParams(ImageTool.Inpaint, undefined)).toEqual({ rendering_speed: 'BALANCED' });
    expect(promptRequired('image', IMAGE_TOOL_MODEL[ImageTool.Inpaint])).toBe(true);
  });

  it('inpaint needs a prompt and a mask, the other tools need neither', () => {
    const mask = { regions: [{ left: 0, top: 0, width: 0.5, height: 0.5 }] };

    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, prompt: 'a red hat', mask }).success).toBe(true);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, mask }).success).toBe(false);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, prompt: 'a red hat' }).success).toBe(false);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.RemoveBackground }).success).toBe(true);
  });

  it('recognises a tool model and nothing else', () => {
    expect(isImageToolModel('kie/recraft/remove-background')).toBe(true);
    expect(isImageToolModel('kie/nano-banana-2')).toBe(false);
    expect(isImageToolModel(null)).toBe(false);
  });

  it('asks for no prompt on a tool model', () => {
    expect(promptRequired('image', 'kie/recraft/remove-background')).toBe(false);
    expect(promptRequired('image', 'kie/nano-banana-2')).toBe(true);
  });

  it('only the upscale carries a factor, defaulting to 2', () => {
    expect(imageToolParams(ImageTool.Upscale, undefined)).toEqual({ upscale_factor: '2' });
    expect(imageToolParams(ImageTool.Upscale, '4')).toEqual({ upscale_factor: '4' });
    expect(imageToolParams(ImageTool.RemoveBackground, '4')).toEqual({});
  });
});
