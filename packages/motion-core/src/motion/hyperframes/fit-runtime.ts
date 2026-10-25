export type Size = { width: number; height: number };

export function fitSize(requested: number, measure: (size: number) => Size, box: Size): number {
  const SHRINK = 0.95;
  const MIN_PX = 6;
  const SLACK = 0.5;
  let size = requested;
  let seen = measure(size);
  while (size > MIN_PX && (seen.width > box.width + SLACK || seen.height > box.height + SLACK)) {
    size = Math.round(size * SHRINK * 100) / 100;
    seen = measure(size);
  }
  return size;
}

function fitRuntime(fit: typeof fitSize) {
  const parsed = () => (document.readyState === 'loading' ? new Promise<void>((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })) : Promise.resolve());
  const fitAll = () => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-fit]')) {
      const box = el.closest<HTMLElement>('.box') ?? el.parentElement;
      if (!box) {
        continue;
      }
      const measure = (size: number) => {
        el.style.fontSize = `${size}px`;
        const widths = [el.scrollWidth, el.offsetWidth, ...[...el.querySelectorAll<HTMLElement>('*')].map((c) => c.scrollWidth)];
        return { width: Math.max(...widths), height: el.offsetHeight };
      };
      const shown: [HTMLElement, string][] = [];
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        if (getComputedStyle(node).display === 'none') {
          shown.push([node, node.style.display]);
          node.style.display = 'block';
        }
      }
      const size = fit(Number(el.dataset.fit), measure, { width: box.clientWidth, height: box.clientHeight });
      el.style.fontSize = `${size}px`;
      for (const [node, display] of shown) {
        node.style.display = display;
      }
    }
  };
  return () => parsed().then(fitAll);
}

export const FIT_TEXT = 'FIT_TEXT';

export function fitScript(): string {
  return `<script>var ${FIT_TEXT}=(${fitRuntime.toString()})(${fitSize.toString()});</script>`;
}
