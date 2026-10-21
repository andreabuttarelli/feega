import { describe, expect, it } from 'vitest';
import { BarTab, RightBarHost, moveKeepingScroll, portalInto } from './right-bar-host.svelte';

const el = (name: string) => ({ name }) as unknown as HTMLElement;

describe('one right bar, claimed by whichever surface is showing it', () => {
  it('the last surface to claim the bar holds it, and releasing it hands it back', () => {
    const host = new RightBarHost();
    const canvas = host.claim(el('canvas'), {});
    const editor = host.claim(el('editor'), {});

    expect(host.active).toBe(editor);
    host.release(editor);
    expect(host.active).toBe(canvas);
    host.release(canvas);
    expect(host.active).toBeNull();
  });

  it('a surface that seats the bar in place takes its binding without moving it', () => {
    const host = new RightBarHost();
    const canvasEl = el('canvas');
    host.claim(canvasEl, {});
    const onbusy = () => {};
    const editor = host.claim(null, { onbusy });

    expect(host.holder?.element).toBe(canvasEl);
    expect(host.active?.binding.onbusy).toBe(onbusy);
    host.release(editor);
    expect(host.holder?.element).toBe(canvasEl);
  });

  it('a surface released out of order does not steal the bar from the one on top', () => {
    const host = new RightBarHost();
    const canvas = host.claim(el('canvas'), {});
    const editor = host.claim(el('editor'), {});

    host.release(canvas);
    expect(host.active).toBe(editor);
  });

  it('a prefill already handed to the chat is not handed again when its surface comes back', () => {
    const host = new RightBarHost();
    const first = { text: 'brief', at: 1 };
    host.ask(first);
    host.ask({ text: 'other', at: 2 });
    host.ask(first);

    expect(host.prefill?.text).toBe('other');
  });

  it('Properties is a tab only while the surface on top brings one, beside Guide', () => {
    const host = new RightBarHost();
    host.claim(el('canvas'), {});
    expect(host.tabs).toEqual([BarTab.Chat, BarTab.Guide]);

    let shown = false;
    host.claim(el('editor'), { properties: { get shown() { return shown; }, onshow: (next) => (shown = next) } });
    expect(host.tabs).toEqual([BarTab.Properties, BarTab.Chat, BarTab.Guide]);

    host.select(BarTab.Properties);
    expect(shown).toBe(true);
    expect(host.tab).toBe(BarTab.Properties);

    host.select(BarTab.Guide);
    expect(shown).toBe(false);
    expect(host.tab).toBe(BarTab.Guide);
  });
});

describe('moving the bar keeps where the reader was', () => {
  it('the last scroll offsets come back after the move, even when the bar was detached first', () => {
    const log = { scrollTop: 0 };
    const node = { parentElement: null, contains: (el: unknown) => el === log };
    const moved: unknown[] = [];
    const target = { appendChild: (n: unknown) => moved.push(n) };

    moveKeepingScroll(node as unknown as HTMLElement, target as unknown as HTMLElement, new Map([[log as unknown as Element, 420]]));

    expect(moved).toEqual([node]);
    expect(log.scrollTop).toBe(420);
  });

  it('an element that left the bar is not scrolled', () => {
    const gone = { scrollTop: 0 };
    const node = { parentElement: null, contains: () => false };

    moveKeepingScroll(node as unknown as HTMLElement, { appendChild: () => {} } as unknown as HTMLElement, new Map([[gone as unknown as Element, 99]]));

    expect(gone.scrollTop).toBe(0);
  });
});

describe('a pane portalled into the bar', () => {
  it('leaves the bar when its editor closes, so the next editor is the only inspector', () => {
    const pane = { removed: false, remove() { this.removed = true; } };
    const appended: unknown[] = [];
    const target = { appendChild: (n: unknown) => appended.push(n) };

    const portal = portalInto(pane as unknown as HTMLElement, target as unknown as HTMLElement);
    expect(appended).toEqual([pane]);

    portal.destroy();
    expect(pane.removed).toBe(true);
  });
});
