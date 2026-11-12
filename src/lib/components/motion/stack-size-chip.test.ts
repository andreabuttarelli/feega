// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', async () => await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/svelte/src/index-client.js')));
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setAutoLayout, setChildSize, setLayoutItem, wrapInStack } from '$lib/motion/layout/ops';
import StackSizeChip from './StackSizeChip.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const column = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }, 'a'));
  doc = must(wrapInStack(doc, ['a'], 'box', 'lane'));
  doc = must(setAutoLayout(doc, 'box', { direction: Direction.Vertical }));
  return must(setLayoutItem(doc, 'box', { width: Sizing.Fixed, height: Sizing.Fixed }));
})();

let app: Record<string, unknown> | null = null;

function show(doc: MotionDoc) {
  const commit = vi.fn();
  app = mount(StackSizeChip, { target: document.body, props: { doc, clip: findClip(doc, 'a')!.clip, axis: 'width', sizings: [Sizing.Fixed, Sizing.Hug, Sizing.Fill], commit } });
  flushSync();
  return commit;
}

const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('the stack size chip', () => {
  afterEach(() => {
    if (app) {
      unmount(app);
    }
    app = null;
    document.body.innerHTML = '';
  });

  it('Escape closes the sizing menu and gives focus back to its button', () => {
    show(column);
    const chip = byId('stack-unit-width')!;
    chip.focus();
    chip.click();
    flushSync();
    expect(byId('stack-mode-menu-width')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flushSync();

    expect(byId('stack-mode-menu-width')).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('says so when the stack caps a fixed width below the one set', () => {
    const box = findClip(column, 'box')!.clip;
    const wide = Math.round(Number(box.props.width) * column.width) + 200;
    show(must(setChildSize(column, 'a', 'width', { sizing: Sizing.Fixed, value: wide })));

    expect(byId('stack-capped-width')?.textContent).toMatch(/^Capped at \d+ px by the stack$/);
  });

  it('says nothing when the width fits', () => {
    show(column);

    expect(byId('stack-capped-width')).toBeNull();
  });
});
