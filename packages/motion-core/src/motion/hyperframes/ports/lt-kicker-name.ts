import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-kicker-name',
  title: 'Lower third, kicker and name',
  about: 'A small accent kicker drops in, the big uppercase name slams up with a bounce, and an accent baseline draws beneath.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-kicker-name',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Archivo Black', 'Space Mono'],
  props: {
    kicker: { type: 'string', title: 'Kicker', default: 'Episode 47', group: 'Content', maxLength: 40 },
    person: { type: 'string', title: 'Name', default: 'Maya Chen', group: 'Content', maxLength: 60 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#46e5b7', group: 'Style' },
    kickerColor: { type: 'string', title: 'Kicker text', format: PropFormat.Color, default: '#141518', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const kicker = S.h('span', { style: { display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: String(p.kickerColor), background: String(p.accent), padding: '6px 14px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.kicker)) as HTMLElement;
    const kickWrap = S.h('div', { style: { overflow: 'hidden' } }, kicker);
    const who = S.h('div', { style: { fontFamily: "'Archivo Black', sans-serif", fontSize: 70, fontWeight: 400, color: String(p.nameColor), lineHeight: 0.98, letterSpacing: '-0.015em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: '0 2px 22px rgba(0, 0, 0, 0.5)' } }, String(p.person)) as HTMLElement;
    const base = S.h('div', { style: { height: 5, width: '100%', background: String(p.accent), borderRadius: 3, transformOrigin: '0% 50%' } }) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 130, bottom: 122, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 } }, kickWrap, who, base) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(kicker, { y: -40 }, 0);
    tl.set(who, { y: 34, opacity: 0 }, 0);
    tl.set(base, { scaleX: 0 }, 0);
    tl.to(kicker, { y: 0, duration: 0.42, ease: 'back.out(2)' }, 0.1);
    tl.to(who, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.5)' }, 0.32);
    tl.to(base, { scaleX: 1, duration: 0.5, ease: 'power4.out' }, 0.5);
    tl.to(base, { scaleX: 0, duration: 0.3, ease: 'power2.in' }, 4.25);
    tl.to(who, { y: -16, opacity: 0, duration: 0.32, ease: 'power2.in' }, 4.3);
    tl.to(kicker, { y: -40, duration: 0.3, ease: 'power2.in' }, 4.32);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
