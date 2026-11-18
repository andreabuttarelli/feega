import { describe, expect, it } from 'vitest';
import { movedDocsTarget } from './docs-moved';

describe('removed in-app docs pages', () => {
  it.each([
    ['/docs', 'https://docs.feega.app'],
    ['/docs/', 'https://docs.feega.app'],
    ['/docs/getting-started', 'https://docs.feega.app/getting-started/'],
    ['/docs/brands', 'https://docs.feega.app/canvas/brands/'],
    ['/docs/shopify', 'https://docs.feega.app'],
    ['/docs/webflow', 'https://docs.feega.app'],
    ['/docs/wix', 'https://docs.feega.app'],
    ['/docs/studio', 'https://docs.feega.app'],
    ['/docs/team-invites', 'https://docs.feega.app'],
    ['/docs/anything-else', 'https://docs.feega.app']
  ])('%s sends the reader to %s', (path, target) => {
    expect(movedDocsTarget(path)).toBe(target);
  });
});
