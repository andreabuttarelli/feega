import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

const SWITCH = /searchParams\.(get|has)\(\s*['"]renderer['"]/;
const PIXI = /from\s+'(pixi8|pixi\.js)'|import\(\s*'(pixi8|pixi\.js)'\)/;

describe('the canvas has one renderer: the core', () => {
  it.each(['./GpuFlow.svelte', './CoreFrames.svelte', '../../../../routes/p/[projectId]/c/[canvasId]/+page.svelte', '../../../../routes/s/[token]/+page.svelte'])(
    '%s neither reads ?renderer= nor imports PixiJS',
    (file) => {
      const text = source(file);
      expect(SWITCH.test(text)).toBe(false);
      expect(PIXI.test(text)).toBe(false);
    }
  );
});
