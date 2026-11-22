import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import './ScrollRevealText.css';

const PARAS = [
  'This is placeholder copy. Replace it with a short statement about what your product does and who it is for.',
  'Each word lights up as the reader scrolls, so keep the sentences short and the ideas clear.',
  'Scroll back up and the text fades again. Swap these lines for your own words.'
];

type Unit = { t: string; i: number };
type Word = { units: Unit[] };
type Para = { text: string; words: Word[] };

function split(paras: string[], reveal: string): { paras: Para[]; total: number } {
  let i = 0;
  const out = paras.map((text) => ({
    text,
    words: text.split(' ').map((word) => ({
      units: (reveal === 'char' ? [...word] : [word]).map((t) => ({ t, i: i++ }))
    }))
  }));
  return { paras: out, total: i };
}

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

export function ScrollRevealText({ reveal = 'word' }: { reveal?: 'word' | 'char' }) {
  const root = useRef<HTMLDivElement>(null);
  const view = useMemo(() => split(PARAS, reveal), [reveal]);

  useEffect(() => (root.current ? track(root.current) : undefined), []);

  return (
    <section class="fl-scroll-reveal-text">
      <div class="fl-container">
        <div ref={root} className="reveal" data-reveal={reveal} style={{ '--n': view.total } as CSSProperties}>
          {view.paras.map((para) => (
            <p key={para.text}>
              <span className="sr">{para.text}</span>
              <span aria-hidden="true">
                {para.words.map((word, k) => (
                  <span key={word.units[0].i}>
                    <span className="w">
                      {word.units.map((unit) => (
                        <span key={unit.i} className="u" style={{ '--i': unit.i } as CSSProperties}>{unit.t}</span>
                      ))}
                    </span>
                    {k < para.words.length - 1 ? ' ' : null}
                  </span>
                ))}
              </span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
