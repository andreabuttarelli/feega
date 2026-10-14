// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillsSchema, type Fill } from '$lib/motion/fill/model';
import FillStack from './FillStack.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const stack = (raw: unknown[]) => fillsSchema.parse(raw);
const TWO = stack([
  { type: 'solid', color: '#111111' },
  { type: 'solid', color: '#222222', opacity: 0.5 }
]);
const ASSETS = [
  {
    id: 'pic',
    kind: 'image' as const,
    label: 'Pic',
    previewUrl: 'https://cdn/pic.png'
  }
];

let app: Record<string, unknown> | null = null;

function show(fills: Fill[]) {
  const onchange = vi.fn();
  app = mount(FillStack, {
    target: document.body,
    props: { fills, assets: ASSETS, color: (c: string) => c, onchange }
  });
  flushSync();
  return onchange;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="fill-row"]')];
const inRow = <T extends HTMLElement>(row: number, id: string) => rows()[row].querySelector<T>(`[data-testid="${id}"]`)!;
const sent = (onchange: ReturnType<typeof vi.fn>) => onchange.mock.calls.at(-1)![0] as Fill[];

function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

describe('the fill stack in Properties', () => {
  afterEach(() => {
    if (app) {
      unmount(app);
    }
    app = null;
    document.body.innerHTML = '';
  });

  it('lists the top layer first, like the canvas stacks it', () => {
    show(TWO);
    expect(rows().map((r) => r.dataset.index)).toEqual(['1', '0']);
  });

  it('+ adds a layer on top', () => {
    const onchange = show(TWO);
    document.querySelector<HTMLButtonElement>('[data-testid="fill-add"]')!.click();
    expect(sent(onchange)).toHaveLength(3);
    expect(sent(onchange).slice(0, 2)).toEqual(TWO);
  });

  it('− removes that layer', () => {
    const onchange = show(TWO);
    inRow<HTMLButtonElement>(0, 'fill-remove').click();
    expect(sent(onchange)).toEqual([TWO[0]]);
  });

  it('the eye hides a layer without removing it', () => {
    const onchange = show(TWO);
    inRow<HTMLButtonElement>(1, 'fill-eye').click();
    expect(sent(onchange)[0].visible).toBe(false);
    expect(sent(onchange)).toHaveLength(2);
  });

  it('opacity is typed in percent', () => {
    const onchange = show(TWO);
    change(inRow<HTMLInputElement>(1, 'fill-opacity'), '40');
    expect(sent(onchange)[0].opacity).toBe(0.4);
  });

  it('dragging a row onto another reorders the stack', () => {
    const onchange = show(TWO);
    rows()[0].dispatchEvent(new Event('dragstart', { bubbles: true }));
    rows()[1].dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    rows()[1].dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    flushSync();
    expect(sent(onchange)).toEqual([TWO[1], TWO[0]]);
  });

  it('the type switcher turns a colour into a gradient with that colour', () => {
    const onchange = show(TWO);
    change(inRow<HTMLSelectElement>(1, 'fill-type'), 'linear-gradient');
    expect(sent(onchange)[0]).toMatchObject({
      type: 'linear-gradient',
      stops: [
        { color: '#111111', pos: 0 },
        { color: '#ffffff', pos: 1 }
      ]
    });
  });

  it('a gradient shows its stops on a bar and its angle', () => {
    const onchange = show(
      stack([
        {
          type: 'linear-gradient',
          angle: 45,
          stops: [
            { color: '#000000', pos: 0 },
            { color: '#ffffff', pos: 1 }
          ]
        }
      ])
    );
    document.querySelector<HTMLButtonElement>('[data-testid="fill-row"]')!.click();
    flushSync();
    expect(document.querySelectorAll('[data-testid="fill-stop"]')).toHaveLength(2);
    change(document.querySelector<HTMLInputElement>('[data-testid="fill-angle"]')!, '180');
    expect(sent(onchange)[0]).toMatchObject({ angle: 180 });
  });

  it('an image layer picks a picture and a fit', () => {
    const onchange = show(stack([{ type: 'image' }]));
    document.querySelector<HTMLButtonElement>('[data-testid="fill-row"]')!.click();
    flushSync();
    document.querySelector<HTMLButtonElement>('[data-testid="fill-asset"]')!.click();
    expect(sent(onchange)[0]).toMatchObject({ type: 'image', assetId: 'pic' });
    change(document.querySelector<HTMLSelectElement>('[data-testid="fill-fit"]')!, 'tile');
    expect(sent(onchange)[0]).toMatchObject({ fit: 'tile' });
  });
});
