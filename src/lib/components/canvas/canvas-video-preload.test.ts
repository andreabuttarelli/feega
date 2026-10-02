import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const routes = join(here, '../../../routes');

const SURFACES = [
  join(here, 'UploadedNode.svelte'),
  join(here, 'AudioResult.svelte'),
  join(routes, 'p/[projectId]/c/[canvasId]/+page.svelte'),
  join(routes, 's/[token]/+page.svelte')
];

const VIDEO_TAG = /<video\b[^>]*>/g;

describe('a video on the canvas downloads its metadata, not the whole file, until it is played', () => {
  it.each(SURFACES)('%s', (file) => {
    const tags = readFileSync(file, 'utf8').match(VIDEO_TAG) ?? [];

    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toMatch(/preload="(metadata|none)"/);
    }
  });
});
