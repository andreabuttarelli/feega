import { describe, expect, it } from 'vitest';
import { GL_PICTURE_SIDE, glPictureSize } from './core-web';

describe('glPictureSize', () => {
  it('keeps a picture that fits the WebGL atlas as it is', () => {
    expect(glPictureSize({ width: 1080, height: 720 })).toEqual({ width: 1080, height: 720 });
  });

  it('shrinks a picture past the atlas side to fit it, keeping its aspect', () => {
    expect(glPictureSize({ width: 5000, height: 2500 })).toEqual({ width: GL_PICTURE_SIDE, height: GL_PICTURE_SIDE / 2 });
    expect(glPictureSize({ width: 3574, height: 3575 })).toEqual({ width: 2047, height: GL_PICTURE_SIDE });
  });
});
