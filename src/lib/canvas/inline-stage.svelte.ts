let offered = $state.raw<{ nodeId: string; el: HTMLElement } | null>(null);

export const inlineStage = {
  offer(nodeId: string, el: HTMLElement) {
    const mine = { nodeId, el };
    offered = mine;
    return () => {
      if (offered === mine) {
        offered = null;
      }
    };
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
    Object.assign(stage.style, { visibility: '', left: px(r.left - layer.left), top: px(r.top - layer.top), width: px(r.width), height: px(r.height) });
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
