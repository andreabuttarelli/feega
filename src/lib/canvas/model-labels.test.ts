import { describe, expect, it } from 'vitest';
import { cleanLabels } from './model-labels';

const choice = (label: string, providerLabel = 'Google') => ({ label, providerLabel });

describe('model labels', () => {
  it('drops the vendor prefix and the codename', () => {
    const [named] = cleanLabels([choice('Google: Nano Banana 2 (Gemini 3.1 Flash Image)')]);

    expect(named.label).toBe('Nano Banana 2');
  });

  it('keeps a label that has neither', () => {
    expect(cleanLabels([choice('Nano Banana Pro')])[0].label).toBe('Nano Banana Pro');
  });

  it('keeps the codename when two models of a vendor would read the same', () => {
    const labels = cleanLabels([choice('Google: Foo (Fast)'), choice('Google: Foo (Slow)')]).map((c) => c.label);

    expect(labels).toEqual(['Foo (Fast)', 'Foo (Slow)']);
  });

  it('keeps a prefix that is not the vendor', () => {
    expect(cleanLabels([choice('Kling: Motion', 'Google')])[0].label).toBe('Kling: Motion');
  });

  it('keeps the original when stripping would leave nothing', () => {
    expect(cleanLabels([choice('(Preview)')])[0].label).toBe('(Preview)');
  });
});
