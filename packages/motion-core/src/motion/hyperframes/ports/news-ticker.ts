import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'news-ticker',
  title: 'News ticker',
  about: 'A broadcast news bar slides up with a live badge, a wiped-in headline and a scrolling strip of headline pills.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'news-ticker',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 210,
  background: '#1b2433',
  fonts: ['Inter'],
  props: {
    live: { type: 'string', title: 'Badge', default: 'Live', group: 'Content', maxLength: 20 },
    desk: { type: 'string', title: 'Desk', default: 'Global Desk', group: 'Content', maxLength: 30 },
    headlineStart: { type: 'string', title: 'Headline start', default: 'AI video tools move from ', group: 'Content', maxLength: 80 },
    headlineAccent: { type: 'string', title: 'Headline accent', default: 'prototype', group: 'Content', maxLength: 40 },
    headlineEnd: { type: 'string', title: 'Headline end', default: ' to production', group: 'Content', maxLength: 80 },
    time: { type: 'string', title: 'Time', default: '09:41 UTC', group: 'Content', maxLength: 20 },
    label: { type: 'string', title: 'Ticker label', default: 'Breaking', group: 'Content', maxLength: 20 },
    items: {
      type: 'string',
      title: 'Ticker items',
      format: PropFormat.Textarea,
      default: 'Creator teams shorten launch cycles by [38%]|Rendering queues clear in under [2 min]|New catalog blocks trending across product demos|Studio editors adopt HTML-first motion systems',
      description: 'Separate items with |, wrap a highlighted figure in [brackets].',
      group: 'Content',
      maxLength: 600
    },
    brand: { type: 'string', title: 'Badge colour', format: PropFormat.Color, default: '#e11d2e', group: 'Style' },
    accent: { type: 'string', title: 'Headline accent colour', format: PropFormat.Color, default: '#ff4455', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const border = '1px solid rgba(255, 255, 255, 0.18)';
    const stretch = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

    const shine = S.h('div', { style: { ...stretch, background: 'radial-gradient(circle at 14% 0%, rgba(255, 255, 255, 0.2), transparent 26%), linear-gradient(110deg, transparent 0 42%, rgba(255, 255, 255, 0.06) 42% 43%, transparent 43% 100%)', opacity: 0.72, pointerEvents: 'none' } });
    const flash = S.h('div', { style: { position: 'absolute', top: 0, bottom: 0, left: -260, zIndex: 3, width: 210, background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent)', transform: 'skewX(-16deg)' } }) as HTMLElement;

    const liveDot = S.h('div', { style: { width: 18, height: 18, borderRadius: 999, background: '#ffffff', boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.55)' } }) as HTMLElement;
    const brandText = S.h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, textTransform: 'uppercase' } },
      S.h('div', { style: { fontSize: 22, fontWeight: 900, lineHeight: 1, letterSpacing: '0.16em' } }, String(p.live)),
      S.h('div', { style: { fontSize: 15, fontWeight: 700, lineHeight: 1, letterSpacing: '0.22em', color: '#ffffff' } }, String(p.desk))
    );
    const brand = S.h('div', { style: { width: 294, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: `linear-gradient(135deg, ${String(p.brand)}, #9f1220)`, boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.16)' } }, liveDot, brandText) as HTMLElement;

    const headline = S.h('h1', { style: { position: 'relative', zIndex: 1, margin: 0, fontSize: 48, fontWeight: 850, lineHeight: 1.02, letterSpacing: 0, whiteSpace: 'nowrap', color: '#ffffff', textShadow: '0 2px 14px rgba(0, 0, 0, 0.34)' } },
      String(p.headlineStart),
      S.h('span', { style: { color: String(p.accent) } }, String(p.headlineAccent)),
      String(p.headlineEnd)
    ) as HTMLElement;
    const time = S.h('div', { style: { position: 'absolute', top: 25, right: 38, padding: '10px 16px', border, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.74)', fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' } }, String(p.time)) as HTMLElement;
    const headlineWrap = S.h('div', { style: { position: 'relative', flex: 1, display: 'flex', alignItems: 'center', padding: '0 250px 0 44px', overflow: 'hidden' } }, headline, time);
    const topRow = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, height: 126, display: 'flex', alignItems: 'stretch' } }, brand, headlineWrap);

    const entries = String(p.items).split('|').map((s) => s.trim()).filter((s) => s.length > 0);
    const looped = entries.concat(entries.slice(0, 2));
    const pill = (text: string) => {
      const parts = text.split(/\[(.+?)\]/);
      const kids = parts.map((part, i) => (i % 2 === 1 ? S.h('span', { style: { padding: '4px 8px', borderRadius: 8, background: '#063344', color: '#c8f8ff', fontWeight: 850, fontVariantNumeric: 'tabular-nums' } }, part) : part));
      return S.h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 14, padding: '13px 18px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 999, background: '#08111f', color: '#ffffff', fontSize: 31, fontWeight: 650, lineHeight: 1, letterSpacing: 0 } },
        S.h('span', { style: { width: 9, height: 9, borderRadius: 999, background: '#e11d2e', boxShadow: '0 0 22px rgba(225, 29, 46, 0.75)' } }),
        ...kids
      );
    };
    const track = S.h('div', { style: { position: 'absolute', left: 34, top: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 34, whiteSpace: 'nowrap' } }, ...looped.map(pill)) as HTMLElement;
    const fadeEdge = { position: 'absolute', top: 0, bottom: 0, zIndex: 2, width: 90, pointerEvents: 'none' } as const;
    const tickerWindow = S.h('div', { style: { position: 'relative', flex: 1, height: '100%', overflow: 'hidden', background: '#050b15' } },
      S.h('div', { style: { ...fadeEdge, left: 0, background: 'linear-gradient(90deg, #050b15, transparent)' } }),
      S.h('div', { style: { ...fadeEdge, right: 0, background: 'linear-gradient(270deg, #050b15, transparent)' } }),
      track
    );
    const label = S.h('div', { style: { width: 294, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.14)', background: '#5f0712', color: '#ffffff', fontSize: 24, fontWeight: 900, lineHeight: 1, letterSpacing: '0.14em', textTransform: 'uppercase' } }, String(p.label)) as HTMLElement;
    const bottomRow = S.h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.11)', background: 'rgba(2, 6, 13, 0.58)' } }, label, tickerWindow);

    const panel = S.h('div', { style: { ...stretch, overflow: 'hidden', border, borderRadius: 28, background: 'linear-gradient(180deg, rgba(21, 31, 48, 0.96), rgba(7, 13, 24, 0.98)), linear-gradient(90deg, rgba(201, 31, 45, 0.72), transparent 38%)' } }, shine, flash, topRow, bottomRow);
    const shell = S.h('section', { style: { position: 'absolute', left: 96, right: 96, bottom: 72, height: 216, filter: 'drop-shadow(0 28px 44px rgba(0, 0, 0, 0.32))', fontFamily: 'Inter, sans-serif', color: '#f8fafc' } }, panel) as HTMLElement;
    view.root.replaceChildren(shell);

    const tl = S.timeline();
    tl.set(shell, { y: 260, opacity: 0 }, 0);
    tl.set(brand, { x: -80, opacity: 0 }, 0);
    tl.set(headline, { y: 26, opacity: 0, clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.set(label, { y: 18, opacity: 0 }, 0);
    tl.set(time, { y: -10, opacity: 0 }, 0);
    tl.set(track, { x: 1260 }, 0);
    tl.set(flash, { x: 0 }, 0);
    tl.to(shell, { y: 0, opacity: 1, duration: 0.52, ease: 'power4.out' }, 0);
    tl.to(brand, { x: 0, opacity: 1, duration: 0.42, ease: 'power3.out' }, 0.08);
    tl.to(headline, { y: 0, opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.62, ease: 'power3.out' }, 0.18);
    tl.to(time, { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out' }, 0.5);
    tl.to(label, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' }, 0.55);
    tl.to(flash, { x: 2040, duration: 0.86, ease: 'power2.inOut' }, 0.34);
    tl.to(track, { x: -1120, duration: 6.05, ease: 'none' }, 0.62);
    tl.to(liveDot, { scale: 1.32, boxShadow: '0 0 0 18px rgba(255,255,255,0)', duration: 0.42, repeat: 11, yoyo: true, ease: 'sine.inOut' }, 0.58);
    tl.to(flash, { x: 4080, duration: 0.72, ease: 'power2.inOut' }, 3.42);
    tl.to(shell, { y: 170, opacity: 0, duration: 0.34, ease: 'power3.in' }, 6.62);

    return (frame) => tl.render(frame / view.fps);
  }
};
