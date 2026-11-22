import { useEffect, useRef } from 'react';
import './ParallaxGallery.css';

const DEPTHS: Record<string, number> = { far: 0.42, mid: 0.7, near: 1 };
const TILE = { w: 1800, h: 1300 };
const MARGIN = { x: 340, y: 420 };
const DESIGN_WIDTH = 1280;
const MIN_SCALE = 0.75;
const STILL = 30;
const RESUME = 1.4;
const KEY_PUSH = 900;
const MAX_STEP = 0.05;
const KEYS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const wrap = (value: number, size: number) => ((value % size) + size) % size;

function gallery(root: HTMLElement): () => void {
  const field = root.querySelector<HTMLElement>('.field')!;
  const layers = [...field.querySelectorAll<HTMLElement>('.layer')];
  const speed = Number(root.dataset.drift ?? 0);
  const friction = Number(root.dataset.inertia ?? 1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cards: { el: HTMLElement; depth: number; x: number; y: number }[] = [];
  let scale = 1;
  let pan = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let drift = 0;
  let flow = reduced ? 0 : 1;
  let dragging = false;
  let last = { x: 0, y: 0, time: 0 };
  let visible = false;
  let frame = 0;
  let then = 0;

  function measure() {
    scale = Math.max(MIN_SCALE, field.clientWidth / DESIGN_WIDTH);
    cards = layers.flatMap((layer) => {
      layer.style.transform = 'scale(' + scale + ')';
      const depth = DEPTHS[layer.dataset.depth ?? 'near'] ?? 1;
      return [...layer.querySelectorAll<HTMLElement>('.card')].map((el) => ({ el, depth, x: el.offsetLeft, y: el.offsetTop }));
    });
    place();
  }

  function place() {
    for (const c of cards) {
      const x = wrap(c.x + (pan.x * c.depth) / scale + MARGIN.x, TILE.w) - MARGIN.x - c.x;
      const y = wrap(c.y + ((pan.y + drift) * c.depth) / scale + MARGIN.y, TILE.h) - MARGIN.y - c.y;
      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  const idle = () => reduced && !dragging && Math.hypot(velocity.x, velocity.y) < 1;

  function tick(now: number) {
    frame = 0;
    const dt = Math.min(MAX_STEP, (now - then) / 1000 || 0);
    then = now;
    if (!dragging) {
      pan.x += velocity.x * dt;
      pan.y += velocity.y * dt;
      const decay = Math.exp(-friction * dt);
      velocity.x *= decay;
      velocity.y *= decay;
    }
    const target = reduced || dragging || Math.hypot(velocity.x, velocity.y) > STILL ? 0 : 1;
    flow += (target - flow) * Math.min(1, dt * RESUME);
    drift -= speed * flow * dt;
    place();
    if (!idle()) {
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

  function onDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    velocity = { x: 0, y: 0 };
    last = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    field.setPointerCapture(event.pointerId);
    field.dataset.dragging = '';
    wake();
  }

  function onMove(event: PointerEvent) {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    const dt = Math.max(1, event.timeStamp - last.time) / 1000;
    pan.x += dx;
    pan.y += dy;
    velocity = { x: velocity.x * 0.6 + (dx / dt) * 0.4, y: velocity.y * 0.6 + (dy / dt) * 0.4 };
    last = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    place();
  }

  function onUp() {
    if (!dragging) {
      return;
    }
    dragging = false;
    delete field.dataset.dragging;
    wake();
  }

  function onKey(event: KeyboardEvent) {
    const push = KEYS[event.key];
    if (!push) {
      return;
    }
    event.preventDefault();
    velocity = { x: velocity.x + push[0] * KEY_PUSH, y: velocity.y + push[1] * KEY_PUSH };
    wake();
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
  const resize = new ResizeObserver(() => measure());

  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onUp);
  field.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  sight.observe(field);
  resize.observe(field);
  measure();

  return () => {
    sleep();
    sight.disconnect();
    resize.disconnect();
    field.removeEventListener('pointerdown', onDown);
    field.removeEventListener('pointermove', onMove);
    field.removeEventListener('pointerup', onUp);
    field.removeEventListener('pointercancel', onUp);
    field.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const c of cards) {
      c.el.style.transform = '';
    }
  };
}

export function ParallaxGallery() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? gallery(root.current) : undefined), []);

  return (
    <section ref={root} className="fl-parallax-gallery" aria-label="Gallery" data-drift="24" data-inertia="3.5">
      <div className="field" role="application" tabIndex={0} aria-label="Image gallery. Drag, swipe or use the arrow keys to move it.">
        <div className="layer" data-depth="far">
          <figure className="card" style={{ left: 980, top: 120, width: 130 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/11.webp" width="560" height="420" alt="A red mushroom glowing at night" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 360, top: 560, width: 110 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/02.webp" width="560" height="442" alt="A starry sky through jungle branches" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1700, top: 520, width: 96 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/06.webp" width="560" height="560" alt="A teal planet over floating islands" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 700, top: 1000, width: 120 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/03.webp" width="560" height="527" alt="A waterfall in a moonlit jungle" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 180, top: 1120, width: 140 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/01.webp" width="560" height="440" alt="Glowing violet mushrooms in a night jungle" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1180, top: 420, width: 100 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/10.webp" width="560" height="593" alt="Ferns lit in teal" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1500, top: 1180, width: 118 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/08.webp" width="560" height="436" alt="Pink mushrooms in violet light" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 560, top: 380, width: 120 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/12.webp" width="560" height="402" alt="Green floating islands" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 860, top: 820, width: 90 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/05.webp" width="560" height="805" alt="Glowing flower fronds at night" draggable="false" decoding="async" /></figure>
        </div>
        <div className="layer" data-depth="mid">
          <figure className="card" style={{ left: 560, top: 40, width: 210 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/01.webp" width="560" height="440" alt="Glowing violet mushrooms in a night jungle" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 760, top: 330, width: 200 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/03.webp" width="560" height="527" alt="A waterfall in a moonlit jungle" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1240, top: 20, width: 220 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/12.webp" width="560" height="402" alt="Green floating islands" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 420, top: 720, width: 180 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/04.webp" width="560" height="784" alt="Luminous blue grass stems" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1560, top: 760, width: 200 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/10.webp" width="560" height="593" alt="Ferns lit in teal" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 40, top: 820, width: 190 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/06.webp" width="560" height="560" alt="A teal planet over floating islands" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1300, top: 1060, width: 210 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/08.webp" width="560" height="436" alt="Pink mushrooms in violet light" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 40, top: 470, width: 170 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/11.webp" width="560" height="420" alt="A red mushroom glowing at night" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 620, top: 880, width: 190 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/02.webp" width="560" height="442" alt="A starry sky through jungle branches" draggable="false" decoding="async" /></figure>
        </div>
        <div className="layer" data-depth="near">
          <figure className="card" style={{ left: 140, top: 120, width: 300 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/09.webp" width="560" height="678" alt="An old tree at night" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1020, top: 640, width: 270 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/05.webp" width="560" height="805" alt="Glowing flower fronds at night" draggable="false" decoding="async" /></figure>
          <figure className="card" style={{ left: 1480, top: 160, width: 320 }}><img src="https://www.feega.app/templates-assets/parallax-gallery/07.webp" width="560" height="300" alt="A river under glowing plants" draggable="false" decoding="async" /></figure>
        </div>
      </div>
    </section>
  );
}
