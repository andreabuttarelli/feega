import { useEffect, useRef } from 'react';
import './ScrollRevealText.css';

const START = 0.8;
const END = 0.4;

function track(root: HTMLElement): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.style.setProperty('--p', '1');
    return () => {};
  }

  let frame = 0;

  function update() {
    frame = 0;
    const rect = root.getBoundingClientRect();
    const raw = (innerHeight * START - rect.top) / (rect.height + innerHeight * (START - END));
    root.style.setProperty('--p', String(Math.min(1, Math.max(0, raw))));
  }

  function schedule() {
    if (!frame) {
      frame = requestAnimationFrame(update);
    }
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();

  return () => {
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  };
}

function build(root: HTMLElement, reveal: string) {
  let i = 0;

  root.querySelectorAll('p').forEach((p) => {
    const text = (p.textContent ?? '').trim();
    const hidden = document.createElement('span');
    hidden.setAttribute('aria-hidden', 'true');

    text.split(' ').forEach((word, index, all) => {
      const w = document.createElement('span');
      w.className = 'w';
      (reveal === 'char' ? [...word] : [word]).forEach((t) => {
        const u = document.createElement('span');
        u.className = 'u';
        u.textContent = t;
        u.style.setProperty('--i', String(i++));
        w.append(u);
      });
      hidden.append(w);
      if (index < all.length - 1) {
        hidden.append(' ');
      }
    });

    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    p.replaceChildren(sr, hidden);
  });

  root.style.setProperty('--n', String(i));
}

function mount(root: HTMLElement): () => void {
  if (!root.hasAttribute('data-ready')) {
    root.setAttribute('data-ready', '');
    build(root, root.dataset.reveal === 'char' ? 'char' : 'word');
  }
  return track(root);
}

export function ScrollRevealText() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
    <section className="fl-scroll-reveal-text">
      <div className="fl-container">
        <div className="reveal" data-reveal="word" ref={root}>
          <p>This is placeholder copy. Replace it with a short statement about what your product does and who it is for.</p>
          <p>Each word lights up as the reader scrolls, so keep the sentences short and the ideas clear.</p>
          <p>Scroll back up and the text fades again. Swap these lines for your own words.</p>
        </div>
      </div>
    </section>
  );
}
