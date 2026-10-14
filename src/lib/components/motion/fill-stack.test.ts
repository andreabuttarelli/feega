// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { fillsSchema, type Fill } from '$lib/motion/fill/model';
import FillStack from './FillStack.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const stack = (raw: unknown[]) => fillsSchema.parse(raw);
const TWO = stack([{ type: 'solid', color: '#111111' }, { type: 'solid', color: '#222222', opacity: 0.5 }]);
const ASSETS = [{ id: 'pic', kind: 'image' as const, label: 'Pic', previewUrl: 'https://cdn/pic.png' }];

let app: Record<string, unknown> | null = null;

function show(fills: Fill[]) {
  const onchange = vi.fn();
  app = mount(FillStack, { target: document.body, props: { fills, assets: ASSETS, tokens: FEEGA_TOKENS, onchange } });
  flushSync();
  return onchange;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="fill-row"]')];
const inRow = <T extends HTMLElement>(row: number, id: string) => rows()[row].querySelector<T>(`[data-testid="${id}"]`)!;
const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
const sent = (onchange: ReturnType<typeof vi.fn>) => onchange.mock.calls.at(-1)![0] as Fill[];

function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

function click(el: HTMLElement) {
  el.click();
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

  it('+ opens a menu of fill types and adds the picked one on top', () => {
    const onchange = show(TWO);
    click(byId('fill-add'));
    expect([...document.querySelectorAll('[data-testid="fill-add-menu"] [role="menuitem"]')].map((b) => b.textContent)).toEqual(['Solid', 'Linear', 'Radial', 'Image']);
    click(byId('fill-add-linear-gradient'));
    expect(sent(onchange)).toHaveLength(3);
    expect(sent(onchange).slice(0, 2)).toEqual(TWO);
    expect(sent(onchange)[2].type).toBe('linear-gradient');
  });

  it('− removes that layer', () => {
    const onchange = show(TWO);
    click(inRow(0, 'fill-remove'));
    expect(sent(onchange)).toEqual([TWO[0]]);
  });

  it('the eye hides a layer without removing it', () => {
    const onchange = show(TWO);
    click(inRow(1, 'fill-eye'));
    expect(sent(onchange)[0].visible).toBe(false);
    expect(sent(onchange)).toHaveLength(2);
  });

  it('layer opacity is typed in percent', () => {
    const onchange = show(TWO);
    change(inRow<HTMLInputElement>(1, 'fill-opacity'), '40');
    expect(sent(onchange)[0].opacity).toBe(0.4);
  });

  it('a colour has its own alpha, apart from the layer opacity', () => {
    const onchange = show(TWO);
    click(rows()[1]);
    change(byId<HTMLInputElement>('fill-alpha'), '50');
    expect(sent(onchange)[0]).toMatchObject({ color: '#11111180', opacity: 1 });
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
    expect(sent(onchange)[0]).toMatchObject({ type: 'linear-gradient', stops: [{ color: '#111111', pos: 0 }, { color: '#ffffff', pos: 1 }] });
  });

  it('the swatch opens the layer editor', () => {
    show(TWO);
    click(inRow(0, 'fill-swatch'));
    expect(document.querySelectorAll('[data-testid="fill-editor"]')).toHaveLength(1);
  });

  it('a layer shows only its own type fields', () => {
    show(stack([{ type: 'solid', color: '#000000' }]));
    click(rows()[0]);
    expect(document.querySelector('[data-testid="fill-angle"]')).toBeNull();
    expect(document.querySelector('[data-testid="fill-fit"]')).toBeNull();
    expect(document.querySelectorAll('[data-colour]')).toHaveLength(1);
  });

  it('a gradient shows its stops on a bar, each stop with its alpha, and its angle', () => {
    const onchange = show(stack([{ type: 'linear-gradient', angle: 45, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }]));
    click(rows()[0]);
    expect(document.querySelectorAll('[data-testid="fill-stop"]')).toHaveLength(2);
    change(byId<HTMLInputElement>('fill-alpha'), '25');
    expect((sent(onchange)[0] as { stops: { color: string }[] }).stops[0].color).toBe('#00000040');
    change(byId<HTMLInputElement>('fill-angle'), '180');
    expect(sent(onchange)[0]).toMatchObject({ angle: 180 });
  });

  it('an image layer picks a picture and a fit', () => {
    const onchange = show(stack([{ type: 'image' }]));
    click(rows()[0]);
    click(byId('fill-asset'));
    expect(sent(onchange)[0]).toMatchObject({ type: 'image', assetId: 'pic' });
    change(byId<HTMLSelectElement>('fill-fit'), 'tile');
    expect(sent(onchange)[0]).toMatchObject({ fit: 'tile' });
  });
});
