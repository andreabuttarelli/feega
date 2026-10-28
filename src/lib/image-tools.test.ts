import { describe, expect, it } from 'vitest';
import { IMAGE_TOOL_MODEL, ImageTool, imageToolAskSchema, imageToolParams, isImageToolModel, MaskPaint, maskPaintOf } from './image-tools';
import { promptRequired } from '$lib/canvas/gen-node';

describe('image tools', () => {
  it('names the kie model behind every tool', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.RemoveBackground]).toBe('kie/recraft/remove-background');
    expect(IMAGE_TOOL_MODEL[ImageTool.Upscale]).toBe('kie/recraft/crisp-upscale');
  });

  it('splits layers on kie seedream and carries no params', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.SplitLayers]).toBe('kie/seedream/5-flash-layer-decomposition');
    expect(imageToolParams(ImageTool.SplitLayers)).toEqual({});
  });

  it('inpaints on kie ideogram edit, balanced by default, and still wants a prompt', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.Inpaint]).toBe('kie/ideogram/v3-edit');
    expect(imageToolParams(ImageTool.Inpaint)).toEqual({ rendering_speed: 'BALANCED' });
    expect(promptRequired('image', IMAGE_TOOL_MODEL[ImageTool.Inpaint])).toBe(true);
  });

  it('inpaint needs a prompt and a mask, the other tools need neither', () => {
    const mask = { regions: [{ left: 0, top: 0, width: 0.5, height: 0.5 }] };

    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, prompt: 'a red hat', mask }).success).toBe(true);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, mask }).success).toBe(false);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Inpaint, prompt: 'a red hat' }).success).toBe(false);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.RemoveBackground }).success).toBe(true);
  });

  it('reframe reuses the edit model and needs an aspect, not a prompt', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.Reframe]).toBe(IMAGE_TOOL_MODEL[ImageTool.Outpaint]);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Reframe, aspect: '9:16' }).success).toBe(true);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Reframe }).success).toBe(false);
  });

  it('outpaint reuses the edit model, and needs a prompt and an extension', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.Outpaint]).toBe(IMAGE_TOOL_MODEL[ImageTool.Inpaint]);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Outpaint, prompt: 'more sky', extend: { top: 0.3 } }).success).toBe(true);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Outpaint, extend: { top: 0.3 } }).success).toBe(false);
    expect(imageToolAskSchema.safeParse({ nodeId: 'n', tool: ImageTool.Outpaint, prompt: 'more sky' }).success).toBe(false);
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

  it('no image tool but the edit ones carries a parameter', () => {
    expect(imageToolParams(ImageTool.Upscale)).toEqual({});
    expect(imageToolParams(ImageTool.RemoveBackground)).toEqual({});
  });

  it('the edit model repaints black, so the area to change is painted black', () => {
    expect(maskPaintOf(ImageTool.Inpaint)).toBe(MaskPaint.Black);
    expect(maskPaintOf(ImageTool.Outpaint)).toBe(MaskPaint.Black);
    expect(maskPaintOf(ImageTool.Reframe)).toBe(MaskPaint.Black);
  });
});
