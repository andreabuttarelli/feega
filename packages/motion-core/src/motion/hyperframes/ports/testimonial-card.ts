import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'testimonial-card',
  title: 'Testimonial card',
  about: 'A dark card with a star rating and a customer quote that rises in, followed by the author avatar, name and handle.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'testimonial-card',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#070a12',
  fonts: ['Inter'],
  props: {
    quote: { type: 'string', title: 'Quote', default: 'This changed how we ship.', group: 'Content', maxLength: 240 },
    author: { type: 'string', title: 'Author', default: 'Ken Tanaka', group: 'Content', maxLength: 60 },
    handle: { type: 'string', title: 'Handle', default: '@ken', group: 'Content', maxLength: 40 },
    rating: { type: 'number', title: 'Rating', default: 5, minimum: 0, maximum: 5, group: 'Content' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const U = Math.min(W, H) / 100;
    const FG = '#f8fafc';
    const MUTED = '#a8b3c7';
    const SURFACE = '#151c2c';
    const quote = p.quote == null ? 'This changed how we ship.' : String(p.quote);
    const author = p.author == null ? 'Ken Tanaka' : String(p.author);
    const handle = p.handle == null ? '@ken' : String(p.handle);
    const raw = Number(p.rating);
    const rating = Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : 5;
    const ratingText = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
    const initials = author.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();

    const fillStars = S.h('span', { style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${rating * 20}%`, overflow: 'hidden', color: FG, whiteSpace: 'nowrap' } }, '★★★★★');
    const stars = S.h('span', { style: { position: 'relative', display: 'inline-block', color: MUTED, fontSize: U * 3.4, letterSpacing: '0.18em', lineHeight: 1, whiteSpace: 'nowrap' } }, '★★★★★', fillStars);
    const ratingRow = S.h('div', { style: { display: 'flex', alignItems: 'center', gap: U * 2, width: 'max-content', color: MUTED, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: U * 2.4, fontWeight: 650, lineHeight: 1 } }, stars, S.h('span', null, `${ratingText} / 5`));
    const quoteEl = S.h('blockquote', { style: { margin: 0, color: FG, fontSize: U * 5.2, fontWeight: 650, lineHeight: 1.23, letterSpacing: '-0.025em', textWrap: 'balance' } }, quote);
    const proof = S.h('div', { style: { display: 'grid', gap: U * 3.2 } }, ratingRow, quoteEl) as HTMLElement;

    const avatar = S.h('div', { style: { gridRow: '1 / 3', display: 'grid', placeItems: 'center', width: U * 8.4, height: U * 8.4, border: `${H * 0.0016}px solid rgba(248, 250, 252, 0.2)`, borderRadius: '50%', background: '#b8bcc2', color: '#070a12', fontSize: U * 2.65, fontWeight: 780, letterSpacing: '0.03em' } }, initials === '' ? '?' : initials) as HTMLElement;
    const name = S.h('div', { style: { minWidth: 0, alignSelf: 'flex-end', color: FG, fontSize: U * 3.2, fontWeight: 700, lineHeight: 1.08 } }, author) as HTMLElement;
    const handleEl = S.h('div', { style: { minWidth: 0, alignSelf: 'flex-start', color: MUTED, fontSize: U * 2.35, lineHeight: 1.15 } }, handle) as HTMLElement;
    const footer = S.h('footer', { style: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gridTemplateRows: 'auto auto', columnGap: U * 2.7, rowGap: U * 0.65, alignItems: 'center' } }, avatar, name, handleEl);

    const card = S.h('article', { style: { width: Math.min(W * 0.86, H * 1.28), display: 'grid', gap: U * 4.6, padding: U * 6.5, overflow: 'hidden', border: `${H * 0.0016}px solid #34405a`, borderRadius: 28, background: SURFACE, boxShadow: `0 ${H * 0.03}px ${H * 0.08}px rgba(7, 10, 18, 0.68)` } }, proof, footer) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: `${H * 0.06}px ${W * 0.06}px`, fontFamily: 'Inter, system-ui, sans-serif' } }, card);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const fit = Math.min(1, duration / 1.95);
    const outAt = 1.5 * fit + Math.max(0, duration - 1.95 * fit);

    const tl = S.timeline();
    tl.set(proof, { y: '18%', opacity: 0 }, 0);
    tl.set([avatar, name, handleEl], { y: '34%', opacity: 0 }, 0);
    tl.to(proof, { y: '0%', opacity: 1, duration: 0.7 * fit, ease: 'power2.out' }, 0.12 * fit);
    tl.to([avatar, name, handleEl], { y: '0%', opacity: 1, duration: 0.56 * fit, stagger: 0.06 * fit, ease: 'power2.out' }, 0.82 * fit);
    tl.to(card, { opacity: 0, duration: 0.45 * fit, ease: 'power2.in' }, outAt);

    return (frame) => tl.render(frame / view.fps);
  }
};
