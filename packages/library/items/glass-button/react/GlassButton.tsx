import { useEffect, useRef } from 'react';
import './GlassButton.css';

const RIM = 14;
const BEND = 36;
const EASE = 0.16;
const SETTLE = 0.5;
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
  const glow = root.querySelector<HTMLElement>('.glow')!;
  const filter = root.querySelector<SVGFilterElement>('filter')!;
  const map = root.querySelector<SVGFEImageElement>('feImage')!;
  const bend = root.querySelector<SVGFEDisplacementMapElement>('feDisplacementMap')!;
  const speed = Number(root.dataset.speed) || 1;
  const intensity = Number(root.dataset.intensity) || 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const id = 'fl-glass-lens-' + ++lenses;
  const target = { x: 0, y: 0 };
  const at = { x: 0, y: 0 };
  let hovering = false;
  let frame = 0;

  filter.id = id;
  root.style.setProperty('--spin', 6 / speed + 's');
  root.style.setProperty('--glow', String(Math.min(1, 0.9 * intensity)));
  bend.setAttribute('scale', String(BEND * intensity));

  function resize() {
    const w = Math.round(button.offsetWidth);
    const h = Math.round(button.offsetHeight);
    map.setAttribute('width', String(w));
    map.setAttribute('height', String(h));
    map.setAttribute('href', lensMap(w, h));
  }

  function paint() {
    root.style.setProperty('--gx', at.x + 'px');
    root.style.setProperty('--gy', at.y + 'px');
  }

  function step() {
    const k = Math.min(1, EASE * speed);
    at.x += (target.x - at.x) * k;
    at.y += (target.y - at.y) * k;
    paint();

    if (Math.abs(target.x - at.x) + Math.abs(target.y - at.y) < SETTLE) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(step);
  }

  function aim(x: number, y: number, move: 'jump' | 'ease') {
    target.x = x;
    target.y = y;

    if (move === 'jump' || still.matches) {
      at.x = x;
      at.y = y;
      paint();
      return;
    }
    if (!frame) {
      frame = requestAnimationFrame(step);
    }
  }

  function aimAt(event: PointerEvent, move: 'jump' | 'ease') {
    const box = glow.getBoundingClientRect();
    const face = button.getBoundingClientRect();
    root.style.setProperty('--mx', ((event.clientX - face.left) / face.width) * 100 + '%');
    root.style.setProperty('--my', ((event.clientY - face.top) / face.height) * 100 + '%');
    aim(event.clientX - box.left, event.clientY - box.top, move);
  }

  function aimCentre() {
    aim(glow.offsetWidth / 2, glow.offsetHeight / 2, 'jump');
  }

  function showFocus() {
    aimCentre();
    root.setAttribute('data-lit', 'focus');
  }

  function onEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      return;
    }
    aimAt(event, root.getAttribute('data-lit') === 'pointer' ? 'ease' : 'jump');
    hovering = true;
    root.setAttribute('data-lit', 'pointer');
  }

  function onDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }
    aimAt(event, 'jump');
    hovering = true;
    root.setAttribute('data-lit', 'pointer');
  }

  function onMove(event: PointerEvent) {
    if (!hovering) {
      return;
    }
    aimAt(event, 'ease');
  }

  function onLeave() {
    hovering = false;
    root.style.setProperty('--mx', '50%');
    root.style.setProperty('--my', '0%');

    if (button.matches(':focus-visible')) {
      showFocus();
      return;
    }
    root.removeAttribute('data-lit');
  }

  function onUp(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      onLeave();
    }
  }

  function onFocus() {
    if (hovering || !button.matches(':focus-visible')) {
      return;
    }
    showFocus();
  }

  function onBlur() {
    if (hovering) {
      return;
    }
    root.removeAttribute('data-lit');
  }

  const watch = new ResizeObserver(resize);
  const events = [
    [root, 'pointerenter', onEnter],
    [root, 'pointerdown', onDown],
    [root, 'pointermove', onMove],
    [root, 'pointerleave', onLeave],
    [root, 'pointerup', onUp],
    [root, 'pointercancel', onLeave],
    [button, 'focus', onFocus],
    [button, 'blur', onBlur]
  ] as [HTMLElement, string, (event: any) => void][];

  if (refracts()) {
    root.style.setProperty('--lens', 'url(#' + id + ')');
    root.setAttribute('data-lens', '');
    watch.observe(button);
  }
  events.forEach(([el, type, fn]) => el.addEventListener(type, fn));

  return () => {
    cancelAnimationFrame(frame);
    watch.disconnect();
    events.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
    root.removeAttribute('data-lens');
    root.removeAttribute('data-lit');
  };
}

export function GlassButton() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? glass(root.current) : undefined), []);

  return (
    <div ref={root} className="fl-glass-button" data-speed="1" data-intensity="1">
      <span className="glow" aria-hidden="true"><span className="hue"></span></span>
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
