import { describe, expect, it } from 'vitest';
import { layersSource } from './layers-source.svelte';

describe('a rename asked from the canvas', () => {
  it('waits for the layers panel and is taken once', () => {
    layersSource.askRename();

    expect(layersSource.renameAsked).toBe(true);
    expect(layersSource.takeRename()).toBe(true);
    expect(layersSource.takeRename()).toBe(false);
  });
});
