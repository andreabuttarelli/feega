import { describe, expect, it } from 'vitest';
import { VARIABLE_NAME } from '@feega/motion-core/motion/variables-model';
import { collectionOf } from './registry-item';

describe('the variable collection a component lands with', () => {
  it('is its own, named after library and component, so a second component of the same library does not take the first one\'s colours (Magic UI shimmer button exported blue)', () => {
    const shimmer = collectionOf('https://magicui.design/r/shimmer-button-demo.json');

    expect(shimmer).toBe('Magic UI shimmer-button-demo');
    expect(shimmer).not.toBe(collectionOf('https://magicui.design/r/bento-demo.json'));
    expect(collectionOf('https://ui.shadcn.com/r/styles/new-york-v4/a-very-long-component-name-for-a-block.json')).toMatch(VARIABLE_NAME);
  });
});
