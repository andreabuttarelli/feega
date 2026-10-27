// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuiltinFont } from '@feega/motion-core/motion/fonts/model';
import FontPicker from './FontPicker.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;

function open() {
  app = mount(FontPicker, { target: document.body, props: { value: Object.values(BuiltinFont)[0], fonts: [], onpick: vi.fn() } });
  flushSync();
  document.querySelector<HTMLButtonElement>('.font-picker > button')!.click();
  flushSync();
}

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
  document.body.innerHTML = '';
});

describe('font picker', () => {
  it('the dropdown uses the raised popover tokens', () => {
    open();
    const panel = document.querySelector('[role="dialog"]')!;
    expect(panel.className).toContain('bg-ui-raised');
    expect(panel.className).toContain('rounded-md');
    expect(panel.className).toContain('text-ui-text');
  });

  it('the selected row has the selected token, not purple', () => {
    open();
    const on = document.querySelector('li button[aria-current="true"]')!;
    expect(on.className).toContain('bg-ui-selected');
    expect(on.className).not.toContain('purple');
    expect(on.getAttribute('style')).toContain('font-family');
  });

  it('the search placeholder is readable', () => {
    open();
    expect(document.querySelector('input[type="search"]')!.className).toContain('placeholder:text-ui-text-3');
  });

  it('the trigger is a rounded-sm field with the input fill', () => {
    open();
    const trigger = document.querySelector('.font-picker > button')!;
    expect(trigger.className).toContain('rounded-sm');
    expect(trigger.className).toContain('bg-ui-input');
  });
});
