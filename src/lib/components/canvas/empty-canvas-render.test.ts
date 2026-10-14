import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import EmptyCanvas from './EmptyCanvas.svelte';

const noop = () => {};

describe('EmptyCanvas', () => {
  it('draws the prompt line and the three quick actions, the prompt first', () => {
    const body = render(EmptyCanvas, { props: { onaction: noop } }).body;
    const at = (needle: string) => body.indexOf(needle);

    expect(body).toContain('Describe what you want to make…');
    for (const action of ['chat', 'frame', 'image', 'video']) {
      expect(body).toContain(`data-empty-action="${action}"`);
    }
    expect(at('data-empty-action="chat"')).toBeLessThan(at('data-empty-action="frame"'));
    expect(body).toContain('data-testid="empty-canvas"');
  });
});
