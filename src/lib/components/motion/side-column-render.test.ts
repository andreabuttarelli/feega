import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import SideColumn from './SideColumn.svelte';
import { ChatPlace, Side } from '$lib/motion/editor-layout';

const pane = (id: string) => createRawSnippet(() => ({ render: () => `<p data-testid="${id}">${id}</p>` }));

const html = (side: Side, busy = false, place = ChatPlace.Column) =>
  render(SideColumn, { props: { place, side, onside: () => {}, widthPx: 400, onwidth: () => {}, busy, chat: pane('the-chat'), properties: pane('the-props') } }).body;

describe('side column', () => {
  it('keeps the chat mounted, only hidden, while Properties shows', () => {
    const body = html(Side.Properties);

    expect(body).toContain('data-testid="the-chat"');
    expect(body).toMatch(/data-pane="chat"[^>]*hidden/);
    expect(body).not.toMatch(/data-pane="properties"[^>]*hidden/);
  });

  it('is a tablist of two segments, the shown one selected', () => {
    const body = html(Side.Chat);

    expect(body).toContain('role="tablist"');
    expect(body).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Chat/);
    expect(body).toMatch(/data-pane="properties"[^>]*hidden/);
  });

  it('marks the hidden chat while the agent runs', () => {
    expect(html(Side.Properties, true)).toContain('data-testid="chat-activity"');
    expect(html(Side.Chat, true)).not.toContain('data-testid="chat-activity"');
  });

  it('hides nothing and draws no tabs outside the desktop column', () => {
    const body = html(Side.Properties, false, ChatPlace.Drawer);

    expect(body).not.toContain('role="tablist"');
    expect(body).not.toMatch(/data-pane="chat"[^>]*hidden/);
  });
});
