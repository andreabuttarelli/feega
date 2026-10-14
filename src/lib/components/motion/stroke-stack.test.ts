// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { strokesSchema, type Stroke } from '$lib/motion/stroke/model';
import StrokeStack from './StrokeStack.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const SHORT = 1000;
const TWO = strokesSchema.parse([{ paint: { type: 'solid', color: '#111111' } }, { paint: { type: 'solid', color: '#222222' }, width: 0.02 }]);

let app: Record<string, unknown> | null = null;

function show(strokes: Stroke[], sided = false) {
  const onchange = vi.fn();
  app = mount(StrokeStack, { target: document.body, props: { strokes, tokens: FEEGA_TOKENS, sided, short: SHORT, onchange } });
  flushSync();
  return onchange;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="stroke-row"]')];
const inRow = <T extends HTMLElement>(row: number, id: string) => rows()[row].querySelector<T>(`[data-testid="${id}"]`)!;
const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
const sent = (onchange: ReturnType<typeof vi.fn>) => onchange.mock.calls.at(-1)![0] as Stroke[];

function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

function click(el: HTMLElement) {
  el.click();
  flushSync();
}

describe('the stroke stack in Properties', () => {
  afterEach(() => {
    if (app) {
      unmount(app);
    }
    app = null;
    document.body.innerHTML = '';
  });

  it('lists the top stroke first', () => {
    show(TWO);
    expect(rows().map((r) => r.dataset.index)).toEqual(['1', '0']);
  });

  it('a row opens its stroke in a side popover named for it, the row highlighted', () => {
    show(TWO);
    click(rows()[0]);
    const popover = byId('side-popover');
    expect(popover.getAttribute('aria-label')).toBe('Solid stroke');
    expect(byId('side-popover-title').textContent).toBe('Solid');
    expect(popover.dataset.anchor).toBe('1');
    expect(popover.querySelector('[data-testid="stroke-editor"]')).not.toBeNull();
    expect(rows()[0].dataset.open).toBe('true');
    click(rows()[1]);
    expect(document.querySelectorAll('[data-testid="side-popover"]')).toHaveLength(1);
    expect(byId('side-popover').dataset.anchor).toBe('0');
  });

  it('a collapsed row shows swatch, hex or paint, width, eye and remove', () => {
    show(TWO);
    expect(inRow(0, 'stroke-label').textContent).toBe('222222');
    expect([...rows()[0].querySelectorAll('[data-testid]')].map((e) => (e as HTMLElement).dataset.testid)).toEqual(['stroke-swatch', 'stroke-label', 'stroke-width', 'stroke-eye', 'stroke-remove']);
  });

  it('+ adds a stroke on top', () => {
    const onchange = show(TWO);
    click(byId('stroke-add'));
    expect(sent(onchange)).toHaveLength(3);
  });

  it('− removes it, the eye hides it', () => {
    const onchange = show(TWO);
    click(inRow(0, 'stroke-remove'));
    expect(sent(onchange)).toEqual([TWO[0]]);
    click(inRow(1, 'stroke-eye'));
    expect(sent(onchange)[0].visible).toBe(false);
  });

  it('width is typed in px of the frame', () => {
    const onchange = show(TWO);
    expect(inRow<HTMLInputElement>(0, 'stroke-width').value).toBe('20');
    change(inRow<HTMLInputElement>(0, 'stroke-width'), '5');
    expect(sent(onchange)[1].width).toBe(0.005);
  });

  it('the editor sets position, dash, cap and join', () => {
    const onchange = show(TWO);
    click(rows()[1]);
    change(byId<HTMLSelectElement>('stroke-align'), 'outside');
    expect(sent(onchange)[0].align).toBe('outside');
    change(byId<HTMLInputElement>('stroke-dash'), '8');
    expect(sent(onchange)[0].dash).toBe(0.008);
    change(byId<HTMLSelectElement>('stroke-cap'), 'round');
    expect(sent(onchange)[0].cap).toBe('round');
    change(byId<HTMLSelectElement>('stroke-join'), 'bevel');
    expect(sent(onchange)[0].join).toBe('bevel');
  });

  it('a stroke colour carries its own alpha', () => {
    const onchange = show(TWO);
    click(rows()[1]);
    change(document.querySelector<HTMLInputElement>('[aria-label="Stroke colour opacity"]')!, '50%');
    expect(sent(onchange)[0].paint).toMatchObject({ color: '#11111180' });
  });

  it('the paint switches to a gradient keeping its colour', () => {
    const onchange = show(TWO);
    click(rows()[1]);
    change(byId<HTMLSelectElement>('stroke-paint'), 'linear-gradient');
    expect(sent(onchange)[0].paint).toMatchObject({ type: 'linear-gradient', stops: [{ color: '#111111', pos: 0 }, { color: '#ffffff', pos: 1 }] });
  });

  it('per-side widths only on a shape with sides', () => {
    show(TWO);
    click(rows()[0]);
    expect(document.querySelector('[data-testid="stroke-sides"]')).toBeNull();
    if (app) {
      unmount(app);
    }
    document.body.innerHTML = '';
    const onchange = show(TWO, true);
    click(rows()[0]);
    click(byId('stroke-sides'));
    expect(sent(onchange)[1].sides).toEqual([0.02, 0.02, 0.02, 0.02]);
  });

  it('a side width is typed per side', () => {
    const onchange = show(strokesSchema.parse([{ paint: { type: 'solid', color: '#111111' }, sides: [0.01, 0.01, 0.01, 0.01] }]), true);
    click(rows()[0]);
    change(byId<HTMLInputElement>('stroke-side-bottom'), '30');
    expect(sent(onchange)[0].sides).toEqual([0.01, 0.01, 0.03, 0.01]);
  });
});
