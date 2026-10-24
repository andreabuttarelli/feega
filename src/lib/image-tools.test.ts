import { describe, expect, it } from 'vitest';
import { IMAGE_TOOL_MODEL, ImageTool, imageToolParams, isImageToolModel } from './image-tools';
import { promptRequired } from '$lib/canvas/gen-node';

describe('image tools', () => {
  it('names the kie model behind every tool', () => {
    expect(IMAGE_TOOL_MODEL[ImageTool.RemoveBackground]).toBe('kie/recraft/remove-background');
    expect(IMAGE_TOOL_MODEL[ImageTool.Upscale]).toBe('kie/topaz/image-upscale');
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
