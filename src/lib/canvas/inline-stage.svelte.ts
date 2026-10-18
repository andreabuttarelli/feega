import { Paint } from './inline-motion';

type Offer = { nodeId: string; el: HTMLElement };

let offered = $state.raw<Offer | null>(null);
let paint = $state(Paint.Pending);
let leaving = $state<string | null>(null);
let leaveCap: ReturnType<typeof setTimeout> | null = null;

export const LEAVE_CAP_MS = 3000;

function letGo() {
  if (leaveCap) {
    clearTimeout(leaveCap);
    leaveCap = null;
  }
  leaving = null;
}

const SWAP_GRACE_MS = 300;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function reveal(offer: Offer) {
  await nextFrame();
  await nextFrame();
  if (offered !== offer || paint !== Paint.Pending) {
    return;
  }
  paint = Paint.Shown;
  setTimeout(() => {
    if (offered === offer) {
      paint = Paint.Swapped;
    }
  }, SWAP_GRACE_MS);
}

export const inlineStage = {
  offer(nodeId: string, el: HTMLElement) {
    const mine = { nodeId, el };
    offered = mine;
    paint = Paint.Pending;
    return () => {
      if (offered === mine) {
        offered = null;
        paint = Paint.Pending;
      }
    };
  },
  ready(nodeId: string) {
    if (offered?.nodeId === nodeId) {
      void reveal(offered);
    }
  },
  paintOf(nodeId: string): Paint {
    return offered?.nodeId === nodeId ? paint : Paint.Pending;
  },
  leave(nodeId: string) {
    letGo();
    leaving = nodeId;
    leaveCap = setTimeout(letGo, LEAVE_CAP_MS);
  },
  landed(nodeId: string) {
    if (leaving === nodeId) {
      letGo();
    }
  },
  get leaving() {
    return leaving;
  },
  get editing() {
    return offered !== null;
  },
  of(nodeId: string): HTMLElement | null {
    return offered?.nodeId === nodeId ? offered.el : null;
  }
};

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export type Anchor = HTMLElement | null | undefined;

const MOVES = { attributes: true, attributeFilter: ['style', 'class'] };

function ancestors(el: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  for (let at: HTMLElement | null = el; at; at = at.parentElement) {
    chain.push(at);
  }
  return chain;
}

type Box = { left: number; top: number; width: number; height: number };

const RADIANS_PER_DEGREE = Math.PI / 180;
const PRECISION = 1000;
const exact = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function stageOver(onScreen: Box, size: { width: number; height: number }, degrees: number): Box & { rotate: number } {
  const turn = degrees * RADIANS_PER_DEGREE;
  const spans = size.width * Math.abs(Math.cos(turn)) + size.height * Math.abs(Math.sin(turn));
  if (spans === 0) {
    return { ...onScreen, rotate: degrees };
  }
  const scale = onScreen.width / spans;
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    left: exact(onScreen.left + onScreen.width / 2 - width / 2),
    top: exact(onScreen.top + onScreen.height / 2 - height / 2),
    width: exact(width),
    height: exact(height),
    rotate: degrees
  };
}

function turnOf(el: HTMLElement): number {
  return ancestors(el).reduce((sum, at) => sum + (parseFloat(getComputedStyle(at).rotate) || 0), 0);
}

export function anchoredTo(stage: HTMLElement, host: Anchor) {
  let target = host;

  function place() {
    if (target === undefined) {
      return;
    }
    const layer = getComputedStyle(stage).position === 'fixed' ? { left: 0, top: 0 } : (stage.offsetParent ?? stage.parentElement)?.getBoundingClientRect();
    if (!target || !layer) {
      stage.style.visibility = 'hidden';
      return;
    }
    const r = target.getBoundingClientRect();
    const box = stageOver({ left: r.left - layer.left, top: r.top - layer.top, width: r.width, height: r.height }, { width: target.offsetWidth, height: target.offsetHeight }, turnOf(target));
    Object.assign(stage.style, { visibility: '', left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height), rotate: box.rotate ? `${box.rotate}deg` : '' });
  }

  const moves = new MutationObserver(place);
  const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);

  function watch() {
    moves.disconnect();
    resizes?.disconnect();
    const watched = [...(target ? ancestors(target) : []), ...(stage.parentElement ? ancestors(stage.parentElement) : [])];
    for (const el of watched) {
      moves.observe(el, MOVES);
      resizes?.observe(el);
    }
    place();
  }

  function forwardWheel(e: WheelEvent) {
    if (!target) {
      return;
    }
    e.preventDefault();
    target.dispatchEvent(new WheelEvent('wheel', e));
  }

  stage.addEventListener('wheel', forwardWheel, { passive: false });
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  watch();
  return {
    place,
    update(next: Anchor) {
      target = next;
      watch();
    },
    destroy() {
      moves.disconnect();
      resizes?.disconnect();
      stage.removeEventListener('wheel', forwardWheel);
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
    }
  };
}
