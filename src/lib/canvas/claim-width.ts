import type { Anchor } from './inline-stage.svelte';

const px = (n: number) => `${Math.ceil(n)}px`;

function naturalWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const gap = parseFloat(style.columnGap) || 0;
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const shown = [...el.children].filter((child): child is HTMLElement => child instanceof HTMLElement && getComputedStyle(child).display !== 'none');
  const content = shown.reduce((sum, child) => sum + Math.max(child.scrollWidth, child.offsetWidth), 0);
  return content + gap * Math.max(0, shown.length - 1) + padding;
}

export function claimsWidth(el: HTMLElement, host: Anchor) {
  let target = host;

  function claim() {
    if (target) {
      target.style.flexBasis = px(naturalWidth(el));
    }
  }

  function release() {
    target?.style.removeProperty('flex-basis');
  }

  const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(claim);
  const watch = () => {
    resizes?.disconnect();
    resizes?.observe(el);
    for (const child of el.children) {
      resizes?.observe(child);
    }
    claim();
  };

  watch();
  return {
    update(next: Anchor) {
      release();
      target = next;
      watch();
    },
    destroy() {
      resizes?.disconnect();
      release();
    }
  };
}
