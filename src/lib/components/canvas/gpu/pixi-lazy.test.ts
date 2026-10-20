import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

const STATIC_IMPORT = (from: string) => new RegExp(`import\\s+(?!type\\b)[^;]*from\\s+'${from.replace(/[$/]/g, '\\$&')}'`);

const PIXI_ONLY = ['$lib/canvas/gpu/scene', 'html-to-image', 'pixi8', 'pixi.js'];

describe('the core canvas path never loads PixiJS', () => {
  it.each(['./GpuFlow.svelte', './CoreFrames.svelte'])('%s imports the Pixi scene and html-to-image only on demand', (file) => {
    const text = source(file);
    expect(PIXI_ONLY.filter((from) => STATIC_IMPORT(from).test(text))).toEqual([]);
  });
});
