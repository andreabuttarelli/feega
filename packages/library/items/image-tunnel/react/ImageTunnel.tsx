import { useEffect, useRef } from 'react';
import './ImageTunnel.css';

type Image = { src?: string; alt: string };

const IMAGES: Image[] = [
  { alt: 'Placeholder image 1' },
  { alt: 'Placeholder image 2' },
  { alt: 'Placeholder image 3' },
  { alt: 'Placeholder image 4' },
  { alt: 'Placeholder image 5' },
  { alt: 'Placeholder image 6' },
  { alt: 'Placeholder image 7' },
  { alt: 'Placeholder image 8' }
];
const HEADING = 'welcome to the tunnel';
const TEXT = 'click to pause, press and hold to speed up';
const CARDS = 16;

function slots(images: Image[]) {
  return Array.from({ length: CARDS }, (_, i) => ({ ...images[i % images.length], i, tone: i % 4 }));
}

const WALLS = ['left', 'right', 'floor', 'ceiling'];
const LANES = [-0.4, 0.35, -0.1, 0.4];
const DEPTH = 10;
const RINGS = 20;
const SPEED = 0.9;
const BOOST = 5;
const EASE = 4;
const MAX_STEP = 0.1;
const HOLD_MS = 250;
const SETTLED = 0.001;
const FADE = 0.4;
const INSET = 1;

function tunnel(root: HTMLElement): () => void {
  const stage = root.querySelector('.stage') as HTMLElement;
  const walls = [...root.querySelectorAll<HTMLElement>('.wall')];
  const cards = [...root.querySelectorAll<HTMLElement>('.card')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let hw = 0;
  let hh = 0;
  let depth = 0;
  let cell = 0;
  let span = 0;
  let offset = 0;
  let speed = 1;
  let paused = false;
  let held = false;
  let pressedAt = 0;
  let visible = true;
  let frame = 0;
  let last = 0;

  function pose(wall: string, lane: number, z: number, inset: number): string {
    if (wall === 'left') {
      return `translate3d(${inset - hw}px,${lane * hh}px,${z}px) rotateY(90deg)`;
    }
    if (wall === 'right') {
      return `translate3d(${hw - inset}px,${lane * hh}px,${z}px) rotateY(-90deg)`;
    }
    if (wall === 'floor') {
      return `translate3d(${lane * hw}px,${hh - inset}px,${z}px) rotateX(90deg)`;
    }
    return `translate3d(${lane * hw}px,${inset - hh}px,${z}px) rotateX(-90deg)`;
  }

  function size(el: HTMLElement, w: number, h: number) {
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.left = `${-w / 2}px`;
    el.style.top = `${-h / 2}px`;
  }

  function measure() {
    hw = stage.clientWidth / 2;
    hh = stage.clientHeight / 2;
    depth = hh * DEPTH;
    cell = depth / RINGS;
    span = depth + cell * 2;
    stage.style.perspective = `${Math.max(hw, hh) * 1.1}px`;
    root.style.setProperty('--cell', `${cell}px`);

    walls.forEach((el) => {
      const side = el.dataset.wall === 'left' || el.dataset.wall === 'right';
      size(el, side ? span : hw * 2, side ? hh * 2 : span);
    });
    cards.forEach((el, i) => {
      const side = i % WALLS.length < 2;
      size(el, side ? hh * 0.62 : hw * 0.5, side ? hh * 0.86 : hw * 0.34);
    });
  }

  function place() {
    const shift = offset % cell;
    walls.forEach((el) => {
      el.style.transform = pose(el.dataset.wall ?? '', 0, shift - depth / 2, 0);
    });
    cards.forEach((el, i) => {
      const z = ((i / cards.length) * span + offset) % span - depth;
      const lane = LANES[Math.floor(i / WALLS.length) % LANES.length];
      el.style.transform = pose(WALLS[i % WALLS.length], lane, z, INSET);
      el.style.opacity = String(Math.min(1, Math.max(0, (z + depth) / (depth * FADE))));
    });
  }

  function tick(now: number) {
    const step = Math.min(MAX_STEP, (now - last) / 1000);
    last = now;
    const goal = held ? BOOST : paused ? 0 : 1;
    speed += (goal - speed) * Math.min(1, step * EASE);
    offset += speed * SPEED * hh * step;
    place();
    frame = 0;
    if (goal === 0 && speed < SETTLED) {
      speed = 0;
      return;
    }
    start();
  }

  function start() {
    if (frame || still || !visible || document.hidden) {
      return;
    }
    if (!last || performance.now() - last > MAX_STEP * 1000) {
      last = performance.now();
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function toggle() {
    paused = !paused;
    start();
  }

  function press() {
    held = true;
    pressedAt = performance.now();
    start();
  }

  function release() {
    if (!held) {
      return;
    }
    held = false;
    if (performance.now() - pressedAt < HOLD_MS) {
      paused = !paused;
    }
    start();
  }

  function key(event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    toggle();
  }

  function sync() {
    if (document.hidden) {
      stop();
      return;
    }
    start();
  }

  const sizes = new ResizeObserver(() => {
    measure();
    place();
  });
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      start();
      return;
    }
    stop();
  });

  sizes.observe(stage);
  view.observe(root);
  root.addEventListener('pointerdown', press);
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('pointerleave', release);
  root.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', sync);
  measure();
  place();
  start();

  return () => {
    stop();
    sizes.disconnect();
    view.disconnect();
    root.removeEventListener('pointerdown', press);
    root.removeEventListener('pointerup', release);
    root.removeEventListener('pointercancel', release);
    root.removeEventListener('pointerleave', release);
    root.removeEventListener('keydown', key);
    document.removeEventListener('visibilitychange', sync);
  };
}

export function ImageTunnel({ images = IMAGES, heading = HEADING, text = TEXT }: { images?: Image[]; heading?: string; text?: string }) {
  const root = useRef<HTMLElement>(null);
  const cards = slots(images);

  useEffect(() => (root.current ? tunnel(root.current) : undefined), []);

  return (
    <section className="fl-image-tunnel" data-theme="dark" tabIndex={0} aria-label="Image tunnel, press to pause" ref={root}>
      <div className="stage">
        <div className="world" aria-hidden="true">
          <div className="wall left" data-wall="left" />
          <div className="wall right" data-wall="right" />
          <div className="wall floor" data-wall="floor" />
          <div className="wall ceiling" data-wall="ceiling" />
          {cards.map((card) => (
            <figure key={card.i} className="card" data-tone={card.tone}>{card.src ? <img src={card.src} alt={card.alt} loading="lazy" decoding="async" /> : null}</figure>
          ))}
        </div>
        <div className="overlay">
          <h2>{heading}</h2>
          <p>{text}</p>
        </div>
      </div>
    </section>
  );
}
