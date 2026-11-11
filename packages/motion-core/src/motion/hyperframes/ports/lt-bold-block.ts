import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-bold-block',
  title: 'Lower third, bold block',
  about: 'A dark block wipes in from the left, the uppercase name slams up inside it and a yellow tag pops up below.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-bold-block',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#2a2d36',
  fonts: ['Archivo Black', 'Space Mono'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Maya Chen', group: 'Content', maxLength: 60 },
    tag: { type: 'string', title: 'Tag', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    block: { type: 'string', title: 'Block', format: PropFormat.Color, default: '#141518', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    accent: { type: 'string', title: 'Tag background', format: PropFormat.Color, default: '#ffd23f', group: 'Style' },
    tagColor: { type: 'string', title: 'Tag text', format: PropFormat.Color, default: '#141518', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const who = S.h('div', { style: { fontFamily: "'Archivo Black', sans-serif", fontSize: 58, fontWeight: 400, color: String(p.nameColor), lineHeight: 0.98, letterSpacing: '-0.015em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.person)) as HTMLElement;
    const tag = S.h('span', { style: { display: 'inline-block', background: String(p.accent), color: String(p.tagColor), fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 16px', whiteSpace: 'nowrap' } }, String(p.tag)) as HTMLElement;
    const tagWrap = S.h('div', { style: { overflow: 'hidden' } }, tag);
    const block = S.h('div', { style: { background: String(p.block), padding: '18px 34px 22px 30px', display: 'inline-flex', flexDirection: 'column', gap: 12 } }, who, tagWrap) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 120, bottom: 116 } }, block) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(block, { clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.set(who, { y: 30, opacity: 0 }, 0);
    tl.set(tag, { y: 40 }, 0);
    tl.to(block, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power4.out' }, 0.1);
    tl.to(who, { y: 0, opacity: 1, duration: 0.42, ease: 'back.out(1.6)' }, 0.26);
    tl.to(tag, { y: 0, duration: 0.45, ease: 'back.out(2)' }, 0.5);
    tl.to(block, { clipPath: 'inset(0 0 0 100%)', duration: 0.4, ease: 'power3.in' }, 4.3);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
