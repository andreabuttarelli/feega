import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { EmptyAction, EMPTY_ACTIONS, chatOpenRequest, requestChat, showsEmptyState } from './empty-canvas';

describe('the first moment of an empty canvas', () => {
  it('shows only on a canvas with no nodes, outside the inline editor', () => {
    expect(showsEmptyState(0, null)).toBe(true);
    expect(showsEmptyState(1, null)).toBe(false);
    expect(showsEmptyState(0, 'node-1')).toBe(false);
  });

  it('offers the chat first, then a frame, an image and a video', () => {
    expect(EMPTY_ACTIONS.map((a) => a.action)).toEqual([EmptyAction.Chat, EmptyAction.Frame, EmptyAction.Image, EmptyAction.Video]);
  });

  it('asking for the chat raises a request the project layout reads', () => {
    const before = get(chatOpenRequest);
    requestChat();
    expect(get(chatOpenRequest)).toBe(before + 1);
  });
});
