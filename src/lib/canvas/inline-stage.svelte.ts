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

export function anchoredTo(stage: HTMLElement, host: Anchor) {
  let target = host;
  let frame = 0;

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

  function forwardWheel(e: WheelEvent) {
    if (!target) {
      return;
    }
    e.preventDefault();
    target.dispatchEvent(new WheelEvent('wheel', e));
  }

  function loop() {
    place();
    frame = requestAnimationFrame(loop);
  }

  stage.addEventListener('wheel', forwardWheel, { passive: false });
  frame = requestAnimationFrame(loop);
  return {
    place,
    update(next: Anchor) {
      target = next;
    },
    destroy() {
      cancelAnimationFrame(frame);
      stage.removeEventListener('wheel', forwardWheel);
    }
  };
}
