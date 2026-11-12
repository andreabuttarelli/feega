import { describe, expect, it } from 'vitest';
import { droppedConstruct, type PaintFacts } from './dropped';

const plain: PaintFacts = { transforms: ['none', 'matrix(1, 0, 0, 1, 12, 0)'], masks: ['none'], canvases: 0 };

describe('a construct the import cannot paint', () => {
  it('is none for moved or scaled boxes and gradient masks', () => {
    expect(droppedConstruct({ ...plain, transforms: ['matrix(1.2, 0, 0, 1.2, 0, 0)'], masks: ['linear-gradient(black, transparent)'] })).toBeNull();
  });

  it('is a 3D transform', () => {
    expect(droppedConstruct({ ...plain, transforms: ['matrix3d(1, 0, 0, 0, 0, 0.9, 0.1, 0, 0, -0.1, 0.9, 0, 0, 0, 0, 1)'] })).toBe('a 3D transform comes in flat');
  });

  it('is a rotated or skewed box', () => {
    expect(droppedConstruct({ ...plain, transforms: ['matrix(0.98, 0.17, -0.17, 0.98, 0, 0)'] })).toBe('a rotation comes in unrotated');
  });

  it('is an image mask', () => {
    expect(droppedConstruct({ ...plain, masks: ['url("shape.svg")'] })).toBe('an image mask is not imported');
  });

  it('is a drawn canvas', () => {
    expect(droppedConstruct({ ...plain, canvases: 1 })).toBe('a <canvas> drawing comes in as one still frame');
  });
});
