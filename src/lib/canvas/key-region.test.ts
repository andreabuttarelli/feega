// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { KEY_REGION_ATTR, Region, claimFocus, regionOf, reachesCanvas } from './key-region.svelte';
import { matchCanvasShortcut } from './shortcuts';

function tree() {
  document.body.innerHTML = `
    <div ${KEY_REGION_ATTR}="${Region.Canvas}"><div id="node"><button id="node-bar"></button></div></div>
    <div ${KEY_REGION_ATTR}="${Region.Layers}"><div id="row" tabindex="-1"></div></div>
    <aside><button id="fill-eye"></button><button id="section-head"></button></aside>
    <div role="menu" id="menu" tabindex="-1"></div>`;
  return (id: string) => document.getElementById(id)!;
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): boolean {
  let reached = false;
  const listen = (e: KeyboardEvent) => (reached = reachesCanvas(regionOf(e.target), matchCanvasShortcut(e)));
  window.addEventListener('keydown', listen);
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  window.removeEventListener('keydown', listen);
  return reached;
}

const PANEL_KEYS = ['Delete', 'Backspace', 'Tab', 'v', 'r', '6', '4', 'ArrowRight', 'Escape'];

describe('key region', () => {
  it('focus on nothing, the canvas or a node on it belongs to the canvas', () => {
    const $ = tree();

    expect(regionOf(document.body)).toBe(Region.Canvas);
    expect(regionOf(null)).toBe(Region.Canvas);
    expect(regionOf($('node-bar'))).toBe(Region.Canvas);
  });

  it('focus in an element no region claims belongs to a panel, never to the canvas', () => {
    const $ = tree();

    expect(regionOf($('fill-eye'))).toBe(Region.Panel);
    expect(regionOf($('menu'))).toBe(Region.Panel);
  });

  it('an inspector button keeps Delete, Backspace, Tab, letters, digits, arrows and Escape away from the canvas', () => {
    const $ = tree();

    for (const key of PANEL_KEYS) {
      expect(press($('fill-eye'), key), key).toBe(false);
      expect(press($('section-head'), key), key).toBe(false);
    }
  });

  it('undo and redo reach the canvas from a panel', () => {
    const $ = tree();

    expect(press($('fill-eye'), 'z', { metaKey: true })).toBe(true);
    expect(press($('fill-eye'), 'z', { metaKey: true, shiftKey: true })).toBe(true);
  });

  it('with focus on the canvas every canvas key acts', () => {
    tree();

    for (const key of PANEL_KEYS) {
      expect(press(document.body, key), key).toBe(true);
    }
  });

  it('the layers list deletes and copies the selection but does not switch tools, nudge or fade', () => {
    const $ = tree();

    expect(press($('row'), 'Delete')).toBe(true);
    expect(press($('row'), 'Backspace')).toBe(true);
    expect(press($('row'), 'c', { metaKey: true })).toBe(true);
    expect(press($('row'), 'Escape')).toBe(true);
    for (const key of ['v', 'r', '6', 'ArrowRight', 'Tab']) {
      expect(press($('row'), key), key).toBe(false);
    }
  });

  it('a press on the canvas takes key focus away from a panel or the layers list, even when the press is cancelled', () => {
    const $ = tree();
    const down = (target: Element) => {
      const e = new Event('pointerdown', { bubbles: true, cancelable: true });
      e.preventDefault();
      target.dispatchEvent(e);
      claimFocus(e);
    };

    $('row').focus();
    down($('node'));
    expect(document.activeElement).toBe(document.body);

    $('fill-eye').focus();
    down($('row'));
    expect(document.activeElement).toBe($('fill-eye'));
  });
});
