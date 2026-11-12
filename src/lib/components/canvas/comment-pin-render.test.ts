import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CommentPin from './CommentPin.svelte';

describe('CommentPin', () => {
  it('carries the zoom it counter-scales by, so the canvas need not restyle every node to tell it', () => {
    const html = render(CommentPin, { props: { ghost: true, at: { x: 10, y: 20 }, zoom: 0.25 } }).body;

    expect(html).toContain('--zoom:0.25');
  });
});
