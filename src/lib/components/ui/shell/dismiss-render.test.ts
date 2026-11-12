// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SidePopover from './SidePopover.svelte';

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

function open(name: string, onclose: () => void, inside: HTMLElement = document.body) {
  const trigger = document.createElement('button');
  trigger.textContent = name;
  inside.append(trigger);
  trigger.focus();
  apps.push(mount(SidePopover, { target: inside, props: { anchor: trigger, title: name, onclose, children: createRawSnippet(() => ({ render: () => `<input data-testid="${name}-field" />` })) } }));
  flushSync();
  return trigger;
}

const escape = () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('dismissible popups', () => {
  it('Escape closes only the topmost popup, one level per press, and never reaches the canvas', () => {
    const canvas = vi.fn();
    window.addEventListener('keydown', canvas);
    const outer = vi.fn();
    const inner = vi.fn();
    open('effect', outer);
    open('colour', inner, document.querySelector<HTMLElement>('[data-testid="side-popover"]')!);

    escape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    unmount(apps.pop()!);
    flushSync();
    escape();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(canvas).not.toHaveBeenCalled();
    window.removeEventListener('keydown', canvas);
  });

  it('Escape from a field inside the popup returns focus to the trigger that opened it', () => {
    const trigger = open('fill', vi.fn());
    document.querySelector<HTMLInputElement>('[data-testid="fill-field"]')!.focus();

    escape();

    expect(document.activeElement).toBe(trigger);
  });
});
