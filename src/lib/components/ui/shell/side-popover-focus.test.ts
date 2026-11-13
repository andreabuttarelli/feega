// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SidePopover from './SidePopover.svelte';
import { onBody } from './on-body';

const dir = dirname(fileURLToPath(import.meta.url));
const { createRawSnippet, flushSync, mount, unmount } = (await import(join(dir, '../../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const apps: Record<string, unknown>[] = [];

afterEach(() => {
  apps.splice(0).reverse().forEach((app) => unmount(app));
  document.body.innerHTML = '';
});

const FIELDS = '<input data-testid="hex" /><input data-testid="opacity" /><select data-testid="blend"></select>';

function open(name: string, focusTrigger: boolean, inside: HTMLElement = document.body) {
  const trigger = document.createElement('button');
  inside.append(trigger);
  if (focusTrigger) {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  apps.push(mount(SidePopover, { target: inside, props: { anchor: trigger, title: name, onclose: vi.fn(), children: createRawSnippet(() => ({ render: () => `<div>${FIELDS.replaceAll('data-testid="', `data-testid="${name}-`)}</div>` })) } }));
  flushSync();
  return trigger;
}

const $ = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const tab = (shiftKey = false) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));

describe('side popover focus', () => {
  it('opened from a focused trigger, focus moves to the first field inside', () => {
    open('fill', true);

    expect(document.activeElement).toBe($('fill-hex'));
  });

  it('opened with nothing focused (a mouse press that does not focus), focus is left alone', () => {
    open('fill', false);

    expect(document.activeElement).toBe(document.body);
  });

  it('Tab and Shift-Tab cycle inside the popover', () => {
    open('fill', true);
    $('fill-blend').focus();

    tab();
    expect(document.activeElement).toBe($('side-popover-close'));

    tab(true);
    expect(document.activeElement).toBe($('fill-blend'));
  });

  it('a nested popover scopes its own focus', () => {
    open('fill', true);
    open('colour', true, document.querySelector<HTMLElement>('[data-testid="side-popover"]')!);

    expect(document.activeElement).toBe($('colour-hex'));
    document.querySelectorAll<HTMLElement>('[data-testid="side-popover"]')[1].querySelector<HTMLElement>('[data-testid="colour-blend"]')!.focus();
    tab();
    expect(document.querySelectorAll('[data-testid="side-popover"]')[1].contains(document.activeElement)).toBe(true);
  });

  it('a popover lifted to the body from inside the trap stays in the trap: Tab reaches it, Tab past it wraps, a press in it keeps the trap open', () => {
    const onclose = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    apps.push(mount(SidePopover, { target: document.body, props: { anchor: trigger, title: 'effect', onclose, children: createRawSnippet(() => ({ render: () => `<div>${FIELDS}<div data-testid="picker"><input data-testid="picker-hex" /></div></div>`, setup: (el) => onBody(el.querySelector<HTMLElement>('[data-testid="picker"]')!) })) } }));
    flushSync();
    const trap = $('side-popover');

    expect(trap.contains($('picker-hex'))).toBe(true);

    $('picker-hex').focus();
    tab();
    expect(document.activeElement).toBe($('side-popover-close'));

    $('picker-hex').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onclose).not.toHaveBeenCalled();
  });

  it('a trigger inside the anchored row (the fill swatch) counts as opening by keyboard', () => {
    const row = document.createElement('div');
    const swatch = document.createElement('button');
    row.append(swatch);
    document.body.append(row);
    swatch.focus();
    swatch.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    apps.push(mount(SidePopover, { target: document.body, props: { anchor: row, title: 'fill', onclose: vi.fn(), children: createRawSnippet(() => ({ render: () => `<div>${FIELDS}</div>` })) } }));
    flushSync();

    expect(document.activeElement).toBe($('hex'));
  });

  it('a pointer press on the trigger opens without moving focus, even if the trigger was keyboard-focused before', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    apps.push(mount(SidePopover, { target: document.body, props: { anchor: trigger, title: 'fill', onclose: vi.fn(), children: createRawSnippet(() => ({ render: () => `<div>${FIELDS}</div>` })) } }));
    flushSync();

    expect(document.activeElement).toBe(trigger);
  });
});
