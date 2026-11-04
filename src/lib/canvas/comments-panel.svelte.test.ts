import { afterEach, describe, expect, it } from 'vitest';
import { commentsPanel } from './comments-panel.svelte';

afterEach(() => commentsPanel.hide());

describe('comments panel', () => {
  it('leaving comment mode closes the panel comment mode opened', () => {
    commentsPanel.place(true);
    commentsPanel.place(false);

    expect(commentsPanel.placing).toBe(false);
    expect(commentsPanel.open).toBe(false);
  });

  it('leaving comment mode keeps a panel that was already open', () => {
    commentsPanel.show();
    commentsPanel.place(true);
    commentsPanel.place(false);

    expect(commentsPanel.open).toBe(true);
  });
});
