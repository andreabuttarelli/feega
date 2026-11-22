import { useEffect, useRef } from 'react';
import './HoverReveal.css';

type RevealImage = { src: string; srcset?: string };

const EASE = 9;
const TRAIL = 0.8;
const IDLE = 2;
const SOFT = 0.35;
const MAX_DPR = 2;
const MAX_STEP = 0.05;
const DRIFT = { x: 0.32, y: 0.26, fx: 0.37, fy: 0.53 };

function reveal(root: HTMLElement, radius: number): () => void {
  const lit = root.querySelector<HTMLImageElement>('img.lit')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const life = reduced ? 0 : TRAIL;
  let size = { w: 0, h: 0, dpr: 1 };
  let target = { x: 0, y: 0 };
  let spot = { x: 0, y: 0 };
  let trail: { x: number; y: number; t: number }[] = [];
  let pointed = -Infinity;
  let clock = 0;
  let visible = false;
  let frame = 0;
  let then = 0;

  if (!ctx) {
    root.dataset.mode = 'mask';
    root.style.setProperty('--r', radius + 'px');
  }

  function resize() {
    const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    size = { w: root.clientWidth, h: root.clientHeight, dpr };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    if (!trail.length) {
      spot = { x: size.w / 2, y: size.h / 2 };
      target = { ...spot };
    }
    wake();
  }

  function cover() {
    const iw = lit.naturalWidth;
    const ih = lit.naturalHeight;
    const scale = Math.max(size.w / iw, size.h / ih);
    return { x: (size.w - iw * scale) / 2, y: (size.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
  }

  function drift() {
    if (reduced) {
      return { x: size.w / 2, y: size.h / 2 };
    }
    return {
      x: size.w / 2 + size.w * DRIFT.x * Math.sin(clock * DRIFT.fx),
      y: size.h / 2 + size.h * DRIFT.y * Math.sin(clock * DRIFT.fy + 1)
    };
  }

  function paint() {
    if (!ctx) {
      root.style.setProperty('--x', spot.x + 'px');
      root.style.setProperty('--y', spot.y + 'px');
      return;
    }
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size.w, size.h);
    if (!lit.complete || !lit.naturalWidth) {
      return;
    }
    for (const point of trail) {
      const age = life ? (clock - point.t) / life : 0;
      const gradient = ctx.createRadialGradient(point.x, point.y, radius * SOFT, point.x, point.y, radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = gradient;
      ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-in';
    const box = cover();
    ctx.drawImage(lit, box.x, box.y, box.w, box.h);
  }

  function tick(now: number) {
    frame = 0;
    const dt = Math.min(MAX_STEP, (now - then) / 1000 || 0);
    then = now;
    clock += dt;
    if (clock - pointed > IDLE) {
      target = drift();
    }
    const pull = reduced ? 1 : 1 - Math.exp(-EASE * dt);
    spot = { x: spot.x + (target.x - spot.x) * pull, y: spot.y + (target.y - spot.y) * pull };
    trail = [...trail.filter((point) => clock - point.t < life), { x: spot.x, y: spot.y, t: clock }];
    paint();
    if (!reduced) {
      wake();
    }
  }

  function wake() {
    if (!frame && visible && !document.hidden) {
      then = then || performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function sleep() {
    cancelAnimationFrame(frame);
    frame = 0;
    then = 0;
  }

  function onMove(event: PointerEvent) {
    const box = root.getBoundingClientRect();
    target = { x: event.clientX - box.left, y: event.clientY - box.top };
    pointed = clock;
    wake();
  }

  function onLeave() {
    pointed = clock;
  }

  function onVisibility() {
    if (document.hidden) {
      sleep();
      return;
    }
    wake();
  }

  const sight = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      wake();
      return;
    }
    sleep();
  });
  const watch = new ResizeObserver(resize);

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerdown', onMove);
  root.addEventListener('pointerleave', onLeave);
  lit.addEventListener('load', wake);
  document.addEventListener('visibilitychange', onVisibility);
  sight.observe(root);
  watch.observe(root);

  return () => {
    sleep();
    sight.disconnect();
    watch.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerdown', onMove);
    root.removeEventListener('pointerleave', onLeave);
    lit.removeEventListener('load', wake);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

const LIT: RevealImage = {"src":"https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp","srcset":"https://www.feega.app/templates-assets/hover-reveal/lit-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp 1670w"};
const DARK: RevealImage = {"src":"https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp","srcset":"https://www.feega.app/templates-assets/hover-reveal/dark-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp 1670w"};

export function HoverReveal({ lit = LIT, dark = DARK, alt = 'A moonlit jungle with floating islands', heading = 'Bring the night to life', radius = 200 }: { lit?: RevealImage; dark?: RevealImage; alt?: string; heading?: string; radius?: number }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? reveal(root.current, radius) : undefined), [radius]);

  return (
    <section ref={root} className="fl-hover-reveal" aria-label={heading} data-theme="dark">
      <img className="dark" src={dark.src} srcSet={dark.srcset} sizes="100vw" alt={alt} />
      <img className="lit" src={lit.src} srcSet={lit.srcset} sizes="100vw" alt="" aria-hidden="true" />
      <canvas aria-hidden="true"></canvas>
      {heading && (
        <div className="overlay">
          <h2>{heading}</h2>
        </div>
      )}
    </section>
  );
}
