import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionPreview from './MotionPreview.svelte';
import { Background } from '$lib/motion/doc';

const body = (background?: Background) => render(MotionPreview, { props: { html: '<div></div>', width: 100, height: 100, ...(background ? { background } : {}) } }).body;

describe('the player behind a see-through picture', () => {
  it('lets the canvas show through a transparent doc, instead of painting black behind it', () => {
    expect(body(Background.Transparent)).toContain('data-backdrop="transparent"');
  });

  it('keeps its dark backdrop for a branded doc', () => {
    expect(body(Background.Brand)).toContain('data-backdrop="brand"');
    expect(body()).toContain('data-backdrop="brand"');
  });
});
