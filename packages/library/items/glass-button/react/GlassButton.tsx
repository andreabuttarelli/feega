import { useEffect, useRef } from 'react';
import './GlassButton.css';

const RIM = 14;
const BEND = 36;
let lenses = 0;

function lensMap(w: number, h: number): string {
  const r = h / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="x"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="black"/></linearGradient><linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="lime"/><stop offset="1" stop-color="black"/></linearGradient><filter id="s"><feGaussianBlur stdDeviation="${RIM / 2}"/></filter></defs><rect width="${w}" height="${h}" fill="black"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/><rect x="${RIM}" y="${RIM}" width="${w - RIM * 2}" height="${h - RIM * 2}" rx="${r - RIM}" fill="gray" filter="url(#s)"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function refracts(): boolean {
  return CSS.supports('backdrop-filter', 'url(#a)') && 'userAgentData' in navigator;
}

function glass(root: HTMLElement): () => void {
  const button = root.querySelector<HTMLElement>('.glass')!;
  const filter = root.querySelector<SVGFilterElement>('filter')!;
  const map = root.querySelector<SVGFEImageElement>('feImage')!;
  const bend = root.querySelector<SVGFEDisplacementMapElement>('feDisplacementMap')!;
  const speed = Number(root.dataset.speed) || 1;
  const intensity = Number(root.dataset.intensity) || 1;
  const id = 'fl-glass-lens-' + ++lenses;

  filter.id = id;
  root.style.setProperty('--spin', 9 / speed + 's');
  root.style.setProperty('--glow', String(Math.min(1, 0.8 * intensity)));
  bend.setAttribute('scale', String(BEND * intensity));

  function resize() {
    const w = Math.round(button.offsetWidth);
    const h = Math.round(button.offsetHeight);
    map.setAttribute('width', String(w));
    map.setAttribute('height', String(h));
    map.setAttribute('href', lensMap(w, h));
  }

  function onMove(event: PointerEvent) {
    const box = button.getBoundingClientRect();
    root.style.setProperty('--mx', ((event.clientX - box.left) / box.width) * 100 + '%');
    root.style.setProperty('--my', ((event.clientY - box.top) / box.height) * 100 + '%');
  }

  function onLeave() {
    root.style.setProperty('--mx', '50%');
    root.style.setProperty('--my', '0%');
  }

  const watch = new ResizeObserver(resize);

  if (refracts()) {
    root.style.setProperty('--lens', 'url(#' + id + ')');
    root.setAttribute('data-lens', '');
    watch.observe(button);
  }
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);

  return () => {
    watch.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    root.removeAttribute('data-lens');
  };
}

export function GlassButton() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? glass(root.current) : undefined), []);

  return (
    <div ref={root} className="fl-glass-button" data-speed="1" data-intensity="1">
      <span className="glow" aria-hidden="true"><span className="orbit"><span className="hue"></span></span></span>
      <button className="glass" type="button"><span className="label">get started</span></button>
      <svg className="lens" aria-hidden="true" focusable="false">
        <filter x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage x="0" y="0" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="36" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </div>
  );
}
