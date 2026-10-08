import type { TipText } from './actions';

export const HOVER_DELAY_MS = 400;
export const LONG_PRESS_MS = 500;
const TOUCH_LINGER_MS = 1500;
const GAP_PX = 6;
const EDGE_PX = 8;
const TOUCH = 'touch';

type Box = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

export function placeTip(anchor: Box, tip: Size, view: Size): { left: number; top: number } {
  const centred = anchor.left + anchor.width / 2 - tip.width / 2;
  const left = Math.max(EDGE_PX, Math.min(centred, view.width - EDGE_PX - tip.width));
  const below = anchor.top + anchor.height + GAP_PX;
  const fitsBelow = below + tip.height <= view.height - EDGE_PX;
  return { left, top: fitsBelow ? below : anchor.top - GAP_PX - tip.height };
}

function render(text: TipText): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ui-tip';
  el.setAttribute('role', 'tooltip');
  const name = document.createElement('span');
  name.textContent = text.name;
  el.append(name);
  if (text.keys) {
    const keys = document.createElement('kbd');
    keys.textContent = text.keys;
    el.append(keys);
  }
  return el;
}

const pointerTypeOf = (e: Event) => (e as PointerEvent).pointerType;

export function tip(node: HTMLElement, initial: TipText) {
  let text = initial;
  let el: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointerFocus = false;
  let swallowClick = false;

  const clear = () => clearTimeout(timer);

  function show() {
    clear();
    if (el) {
      return;
    }
    el = render(text);
    document.body.append(el);
    const spot = placeTip(node.getBoundingClientRect(), el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${spot.left}px`;
    el.style.top = `${spot.top}px`;
  }

  function hide() {
    clear();
    el?.remove();
    el = null;
  }

  const later = (ms: number, fn: () => void) => {
    clear();
    timer = setTimeout(fn, ms);
  };

  function onEnter(e: Event) {
    if (pointerTypeOf(e) === TOUCH) {
      return;
    }
    later(HOVER_DELAY_MS, show);
  }

  function onDown(e: Event) {
    pointerFocus = true;
    swallowClick = false;
    hide();
    if (pointerTypeOf(e) !== TOUCH) {
      return;
    }
    later(LONG_PRESS_MS, () => {
      swallowClick = true;
      show();
    });
  }

  function onUp(e: Event) {
    if (pointerTypeOf(e) !== TOUCH) {
      return;
    }
    if (!el) {
      clear();
      return;
    }
    later(TOUCH_LINGER_MS, hide);
  }

  function onClick(e: Event) {
    if (!swallowClick) {
      return;
    }
    swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onContextMenu(e: Event) {
    if (swallowClick) {
      e.preventDefault();
    }
  }

  function onFocus() {
    if (pointerFocus) {
      return;
    }
    show();
  }

  function onBlur() {
    pointerFocus = false;
    hide();
  }

  function onKey() {
    pointerFocus = false;
    hide();
  }

  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ['pointerenter', onEnter],
    ['pointerleave', hide],
    ['pointerdown', onDown],
    ['pointerup', onUp],
    ['pointercancel', hide],
    ['click', onClick, { capture: true }],
    ['contextmenu', onContextMenu],
    ['focus', onFocus],
    ['blur', onBlur],
    ['keydown', onKey]
  ];
  for (const [type, fn, options] of listeners) {
    node.addEventListener(type, fn, options);
  }

  return {
    update(next: TipText) {
      text = next;
      if (el) {
        hide();
        show();
      }
    },
    destroy() {
      hide();
      for (const [type, fn, options] of listeners) {
        node.removeEventListener(type, fn, options);
      }
    }
  };
}
