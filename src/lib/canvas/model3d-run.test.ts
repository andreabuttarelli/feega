import { describe, expect, it } from 'vitest';
import { cheapestImageChoice, MODEL3D_INPUT_REQUIRED, Model3dPath, model3dPathOf, productShotPrompt } from './model3d-run';
import type { ModelChoice } from './gen-node';

describe('how a 3D run starts', () => {
  it('an image present goes straight to the 3D model, text or not', () => {
    expect(model3dPathOf({ hasImage: true, hasText: false })).toEqual({ kind: 'run', path: Model3dPath.FromImage });
    expect(model3dPathOf({ hasImage: true, hasText: true })).toEqual({ kind: 'run', path: Model3dPath.FromImage });
  });

  it('text alone first becomes an image', () => {
    expect(model3dPathOf({ hasImage: false, hasText: true })).toEqual({ kind: 'run', path: Model3dPath.FromText });
  });

  it('neither is refused with a message the user can act on', () => {
    expect(model3dPathOf({ hasImage: false, hasText: false })).toEqual({ kind: 'refused', error: MODEL3D_INPUT_REQUIRED });
    expect(MODEL3D_INPUT_REQUIRED).toMatch(/image/);
    expect(MODEL3D_INPUT_REQUIRED).toMatch(/describe/i);
  });
});

describe('the image a text becomes', () => {
  it('is one centred object on a white background, the text inside', () => {
    const prompt = productShotPrompt('a red ceramic teapot');
    expect(prompt).toContain('a red ceramic teapot');
    expect(prompt).toMatch(/white background/);
    expect(prompt).toMatch(/centred/);
    expect(prompt).toMatch(/single/i);
  });
});

describe('the image model the text step uses', () => {
  const choice = (id: string, extra: Partial<ModelChoice>): ModelChoice => ({
    id,
    label: id,
    aspectRatios: ['1:1'],
    provider: 'test',
    providerLabel: 'Test',
    inputModalities: ['text'],
    ...extra
  });

  it('is the cheapest one that reads text and is not uncensored', () => {
    const picked = cheapestImageChoice([
      choice('pricey', { unitCredits: 10 }),
      choice('cheap-uncensored', { unitCredits: 1, uncensored: true }),
      choice('image-only', { unitCredits: 1, inputModalities: ['image'] }),
      choice('cheap', { unitCredits: 3 }),
      choice('unpriced', {})
    ]);
    expect(picked?.id).toBe('cheap');
  });

  it('is nothing when no model qualifies', () => {
    expect(cheapestImageChoice([choice('unpriced', {})])).toBeNull();
  });
});
