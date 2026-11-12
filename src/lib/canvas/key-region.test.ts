// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { KEY_REGION_ATTR, Region, claimFocus, regionOf, reachesCanvas, reachesTimeline, releaseFocus, keyOnCanvas, leaveMenu } from './key-region.svelte';
import { Input } from '$lib/components/ui/shell/last-input';
import { matchCanvasShortcut } from './shortcuts';

function tree() {
  document.body.innerHTML = `
    <div ${KEY_REGION_ATTR}="${Region.Canvas}"><div id="node"><button id="node-bar"></button></div></div>
    <div ${KEY_REGION_ATTR}="${Region.Layers}"><div id="row" tabindex="-1"></div></div>
    <aside><button id="fill-eye"></button><button id="section-head"></button><input id="field" /><textarea id="chat"></textarea></aside>
    <div ${KEY_REGION_ATTR}="${Region.Commands}"><button id="tool"></button><input id="rename" /></div>
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

  it('a toolbar button clicked with the pointer hands key focus back to the canvas', () => {
    const $ = tree();
    $('tool').focus();

    releaseFocus(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(document.activeElement).toBe(document.body);
    expect(press(document.body, 'v')).toBe(true);
  });

  it('a toolbar button activated by keyboard keeps focus, and canvas letters stay out of the toolbar', () => {
    const $ = tree();
    $('tool').focus();

    releaseFocus(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(document.activeElement).toBe($('tool'));
    for (const key of PANEL_KEYS) {
      expect(press($('tool'), key), key).toBe(false);
    }
  });

  it('a field inside a toolbar keeps focus after a pointer click, so it can be typed in', () => {
    const $ = tree();
    $('rename').focus();

    releaseFocus(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(document.activeElement).toBe($('rename'));
  });

  it('a toolbar menu closed with the pointer hands focus to the canvas, not back to its button', () => {
    const $ = tree();
    $('menu').focus();
    const close = new Event('closeautofocus', { cancelable: true });

    leaveMenu($('tool'), Input.Pointer, close);

    expect(close.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.body);
    expect(press(document.body, 'v')).toBe(true);
  });

  it('a toolbar menu closed by keyboard, or an inspector menu, gives focus back to its button', () => {
    const $ = tree();
    for (const [trigger, input] of [['tool', Input.Keys], ['fill-eye', Input.Pointer]] as const) {
      $('menu').focus();
      const close = new Event('closeautofocus', { cancelable: true });

      leaveMenu($(trigger), input, close);

      expect(close.defaultPrevented, trigger).toBe(false);
    }
  });

  it('a pointer click on an inspector control keeps its focus', () => {
    const $ = tree();
    $('fill-eye').focus();

    releaseFocus(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(document.activeElement).toBe($('fill-eye'));
  });

  it('timeline keys act from the canvas and the timeline, never from a panel, field or toolbar', () => {
    const $ = tree();

    expect(reachesTimeline(regionOf(document.body))).toBe(true);
    expect(reachesTimeline(regionOf($('row')))).toBe(true);
    expect(reachesTimeline(regionOf($('field')))).toBe(false);
    expect(reachesTimeline(regionOf($('fill-eye')))).toBe(false);
    expect(reachesTimeline(regionOf($('tool')))).toBe(false);
  });

  it('typing in the chat, a rename field or an inspector field never reaches a canvas or timeline window listener', () => {
    const $ = tree();
    const keys = ['v', 'r', 'i', 'o', ' ', '5', 'ArrowLeft', 'ArrowRight', 'Delete', 'Backspace', 'Escape', 'Enter', 'F9', '/'];
    const gates = {
      canvasOnly: (e: KeyboardEvent) => keyOnCanvas(e),
      timeline: (e: KeyboardEvent) => reachesTimeline(regionOf(e.target))
    };

    for (const id of ['chat', 'rename', 'field']) {
      for (const [gate, reaches] of Object.entries(gates)) {
        for (const key of keys) {
          let heard = false;
          const listen = (e: KeyboardEvent) => (heard = reaches(e));
          window.addEventListener('keydown', listen);
          $(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          window.removeEventListener('keydown', listen);
          expect(heard, `${gate} ${id} ${key}`).toBe(false);
        }
      }
    }
  });

  it('canvas-only listeners hear keys with focus on the canvas, not from the layers list', () => {
    const $ = tree();
    const heard = (target: Element) => {
      let ok = false;
      const listen = (e: KeyboardEvent) => (ok = keyOnCanvas(e));
      window.addEventListener('keydown', listen);
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      window.removeEventListener('keydown', listen);
      return ok;
    };

    expect(heard(document.body)).toBe(true);
    expect(heard($('node-bar'))).toBe(true);
    expect(heard($('row'))).toBe(false);
  });
});
