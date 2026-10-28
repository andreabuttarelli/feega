import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const NODE_FILES = ['TieredImage', 'GenNode', 'InfluencerNode', 'StudioBatchNode', 'SelectNode', 'OutputViewer', 'MotionNode'];

function images(file: string): string[] {
  const source = readFileSync(join(dir, `${file}.svelte`), 'utf8');
  return source.match(/<img\b[^>]*>/g) ?? [];
}

describe('node media never starts a native drag', () => {
  for (const file of NODE_FILES) {
    it(`every image in ${file} is draggable="false"`, () => {
      const tags = images(file);

      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag).toContain('draggable="false"');
      }
    });
  }
});

describe('node video presses reach the canvas', () => {
  it('GpuFlow decides pointer ownership with ownsPress, not a blanket video selector', () => {
    const source = readFileSync(join(dir, 'gpu/GpuFlow.svelte'), 'utf8');
    const body = source.slice(source.indexOf('function onDown('), source.indexOf('function startGesture('));

    expect(body).toContain('ownsPress(target, e.clientY)');
    expect(body).not.toContain('closest(INTERACTIVE)');
  });
});
