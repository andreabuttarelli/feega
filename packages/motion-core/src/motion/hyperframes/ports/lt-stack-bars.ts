import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-stack-bars',
  title: 'Lower third, stacked bars',
  about: 'Two stacked bars wipe in from opposite sides: a dark name bar from the left, then a yellow role bar from the right.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-stack-bars',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#2a2d36',
  fonts: ['Archivo Black', 'Space Mono'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    nameBar: { type: 'string', title: 'Name bar', format: PropFormat.Color, default: '#141518', group: 'Style' },
    roleBar: { type: 'string', title: 'Role bar', format: PropFormat.Color, default: '#ffd23f', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#141518', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const who = S.h('div', { style: { fontFamily: "'Archivo Black', sans-serif", fontSize: 52, fontWeight: 400, color: String(p.nameColor), lineHeight: 1, letterSpacing: '-0.015em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.person));
    const role = S.h('div', { style: { fontFamily: "'Space Mono', monospace", fontSize: 23, fontWeight: 700, color: String(p.roleColor), lineHeight: 1, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.role));
    const nameBar = S.h('div', { style: { background: String(p.nameBar), padding: '14px 30px' } }, who) as HTMLElement;
    const roleBar = S.h('div', { style: { background: String(p.roleBar), padding: '9px 22px', marginLeft: 14 } }, role) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 120, bottom: 116, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 } }, nameBar, roleBar) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(nameBar, { clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.set(roleBar, { clipPath: 'inset(0 0 0 100%)' }, 0);
    tl.to(nameBar, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power4.out' }, 0.1);
    tl.to(roleBar, { clipPath: 'inset(0 0% 0 0%)', duration: 0.5, ease: 'power4.out' }, 0.34);
    tl.to(roleBar, { clipPath: 'inset(0 0 0 100%)', duration: 0.32, ease: 'power3.in' }, 4.25);
    tl.to(nameBar, { clipPath: 'inset(0 100% 0 0)', duration: 0.36, ease: 'power3.in' }, 4.32);
    tl.set(wrap, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
