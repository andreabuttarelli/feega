import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'notification-stack',
  title: 'Notification stack',
  about: 'Notification cards drop in one by one from the top and push the older ones down, then the newest card grows slightly while the rest dim.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'notification-stack',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#05070a',
  fonts: ['Inter'],
  props: {
    titles: { type: 'string', title: 'Titles', default: 'Build queued,Checks passed,Deploy live', group: 'Content', maxLength: 400 },
    bodies: { type: 'string', title: 'Bodies', default: 'Pipeline started for main,All 42 checks green,Now serving version 2.4', group: 'Content', maxLength: 600 },
    expand: { type: 'number', title: 'Expand card', default: -1, minimum: -1, maximum: 4, group: 'Content' },
    cues: { type: 'string', title: 'Cues', default: '', group: 'Motion', maxLength: 80 },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' },
    exit: { type: 'string', title: 'Exit', enum: ['none', 'fade', 'up'], default: 'none', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const H = view.height;
    const MIN = Math.min(view.width, H);
    const ACCENTS: Record<string, string> = { green: '#71f5a7', blue: '#61a8ff', violet: '#c5a3ff' };
    const split = (value: unknown, fallback: string) => {
      const raw = value == null || String(value).trim() === '' ? fallback : String(value);
      return raw.split(',').map((token) => token.trim());
    };
    let titles = split(p.titles, 'Build queued,Checks passed,Deploy live').filter((token) => token !== '').slice(0, 5);
    if (titles.length === 0) {
      titles = ['Build queued', 'Checks passed', 'Deploy live'];
    }
    const bodies = split(p.bodies, 'Pipeline started for main,All 42 checks green,Now serving version 2.4');
    const count = titles.length;
    const exit = p.exit === 'fade' || p.exit === 'up' ? String(p.exit) : 'none';
    const accent = ACCENTS[String(p.accent)] ?? ACCENTS.green;
    const expandRaw = Math.round(Number(p.expand));
    const expand = Number.isFinite(expandRaw) && expandRaw >= 0 && expandRaw < count ? expandRaw : count - 1;

    const GAP_CQH = 2;
    const cardH = Math.min(15, (74 - (count - 1) * GAP_CQH) / count);
    const px = H / 100;
    const cardPx = cardH * px;
    const slotPx = (cardH + GAP_CQH) * px;

    const cards = titles.map((title, index) => {
      const text = S.h('span', { style: { display: 'flex', flexDirection: 'column', gap: Math.min(MIN * 0.007, cardPx * 0.06), minWidth: 0 } },
        S.h('span', { style: { overflow: 'hidden', color: '#f8fafc', fontSize: Math.min(MIN * 0.032, cardPx * 0.24), fontWeight: 600, lineHeight: 1.2, letterSpacing: '0.01em', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }, title),
        (bodies[index] || '').trim() === '' ? null : S.h('span', { style: { overflow: 'hidden', color: '#94a3b8', fontSize: Math.min(MIN * 0.025, cardPx * 0.19), fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }, bodies[index].trim())
      );
      const dot = S.h('span', { style: { flex: '0 0 auto', width: Math.min(MIN * 0.017, cardPx * 0.14), height: Math.min(MIN * 0.017, cardPx * 0.14), borderRadius: '50%', background: accent } });
      return S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: cardPx, display: 'flex', alignItems: 'center', gap: MIN * 0.022, padding: `0 ${MIN * 0.022}px`, overflow: 'hidden', border: `${MIN * 0.0016}px solid #334155`, borderRadius: MIN * 0.018, background: '#131a24', boxShadow: `0 ${MIN * 0.01}px ${MIN * 0.03}px rgba(5, 7, 10, 0.45)`, zIndex: index === expand ? 2 : 1 } }, dot, text) as HTMLElement;
    });
    const stage = S.h('div', { style: { position: 'relative', width: Math.min(view.width * 0.54, H * 1.1), height: count * cardPx + (count - 1) * GAP_CQH * px } }, ...cards) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } }, stage);
    view.root.replaceChildren(clip);

    const BASE = 0.2;
    const GAP = 0.55;
    const ENTER = 0.55;
    const SHIFT = 0.45;
    const RESOLVE_DUR = 0.5;
    const duration = view.frames / view.fps;
    const OUT = exit === 'none' ? 0 : Math.min(0.45, duration * 0.25);
    const avail = duration - OUT;
    const latestStart = Math.max(0, avail - 1.05);
    const cueList = String(p.cues == null ? '' : p.cues).split(',');
    const starts: number[] = [];

    for (let i = 0; i < count; i++) {
      const text = (cueList[i] || '').trim();
      const cue = Number(text);
      let at = text !== '' && Number.isFinite(cue) ? cue : BASE + GAP * i;
      if (i > 0) {
        at = Math.max(at, starts[i - 1] + 0.05);
      }
      starts.push(Math.max(0, Math.min(at, latestStart)));
    }

    const last = starts[count - 1];
    const resolve = Math.max(last + 0.1, Math.min(last + 0.65, avail - RESOLVE_DUR));
    const resolveDur = Math.min(RESOLVE_DUR, Math.max(0.001, avail - resolve));
    const enterY = -(cardPx * 0.6);

    const tl = S.timeline();
    cards.forEach((card, index) => {
      const eventCap = Math.max(0.001, (index + 1 < count ? starts[index + 1] : resolve) - starts[index]);
      tl.set(card, { opacity: 0, y: enterY }, 0);
      tl.fromTo(card, { opacity: 0, y: enterY }, { opacity: 1, y: 0, duration: Math.min(ENTER, eventCap), ease: 'power3.out' }, starts[index]);
      for (let j = 0; j < index; j++) {
        tl.fromTo(cards[j], { y: (index - 1 - j) * slotPx }, { y: (index - j) * slotPx, duration: Math.min(SHIFT, eventCap), ease: 'power3.out', immediateRender: false }, starts[index]);
      }
    });

    cards.forEach((card, index) => {
      if (index === expand) {
        tl.fromTo(card, { scale: 1, filter: 'brightness(1)' }, { scale: 1.045, filter: 'brightness(1.1)', duration: resolveDur, ease: 'power2.out', immediateRender: false }, resolve);
        return;
      }
      tl.fromTo(card, { opacity: 1 }, { opacity: Math.max(0.42, 0.72 - 0.07 * (count - 1 - index)), duration: resolveDur, ease: 'power2.out', immediateRender: false }, resolve);
    });

    if (exit !== 'none') {
      tl.to(stage, { opacity: 0, duration: OUT, ease: 'power2.in' }, duration - OUT);
    }
    if (exit === 'up') {
      tl.to(stage, { y: -3 * px, duration: OUT, ease: 'power2.in' }, duration - OUT);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};
