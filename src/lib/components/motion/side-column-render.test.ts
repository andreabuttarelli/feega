import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import SideColumn from './SideColumn.svelte';
import { ChatPlace, Side } from '$lib/motion/editor-layout';

const pane = (id: string) => createRawSnippet(() => ({ render: () => `<p data-testid="${id}">${id}</p>` }));

const html = (side: Side, place = ChatPlace.Column) =>
  render(SideColumn, { props: { place, side, onside: () => {}, widthPx: 400, onwidth: () => {}, chat: pane('the-chat'), properties: pane('the-props') } }).body;

describe('side column', () => {
  it('in the desktop column the chat stays shown: the right bar draws the tabs, not a second column', () => {
    const body = html(Side.Properties);

    expect(body).toContain('data-testid="the-chat"');
    expect(body).not.toContain('role="tablist"');
    expect(body).not.toMatch(/data-pane="chat"[^>]*hidden/);
  });

  it('in the desktop column Properties leaves for the right bar, beside Guide', () => {
    expect(html(Side.Properties)).not.toContain('data-testid="the-props"');
  });

  it('hides nothing and draws no tabs outside the desktop column', () => {
    const body = html(Side.Properties, ChatPlace.Drawer);

    expect(body).not.toContain('role="tablist"');
    expect(body).toContain('data-testid="the-props"');
    expect(body).not.toMatch(/data-pane="chat"[^>]*hidden/);
  });
});
