import { LONG_PRESS_MS } from './tooltip';
import { isTap } from './editor-bar';

export type Point = { x: number; y: number };
type Open = (at: Point) => void;

const TOUCH = 'touch';
const HAPTIC_MS = 5;

function swallowNextClick() {
  const stop = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerdown', stop, true);
  };
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    stop();
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerdown', stop, true);
}

export function pressMenu(node: HTMLElement, initial: Open) {
  let open = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let from: Point | null = null;
  let touching = false;

  const cancel = () => {
    clearTimeout(timer);
    from = null;
  };

  const lift = () => {
    cancel();
    touching = false;
  };

  function onDown(e: PointerEvent) {
    if (e.pointerType !== TOUCH) {
      return;
    }
    const at = { x: e.clientX, y: e.clientY };
    from = at;
    touching = true;
    timer = setTimeout(() => {
      from = null;
      navigator.vibrate?.(HAPTIC_MS);
      swallowNextClick();
      open(at);
    }, LONG_PRESS_MS);
  }

  function onMove(e: PointerEvent) {
    if (from && !isTap(from, { x: e.clientX, y: e.clientY })) {
      cancel();
    }
  }

  function onContext(e: MouseEvent) {
    e.preventDefault();
    if (touching) {
      return;
    }
    open({ x: e.clientX, y: e.clientY });
  }

  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', lift);
  node.addEventListener('pointercancel', lift);
  node.addEventListener('contextmenu', onContext);

  return {
    update(next: Open) {
      open = next;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', lift);
      node.removeEventListener('pointercancel', lift);
      node.removeEventListener('contextmenu', onContext);
    }
  };
}
