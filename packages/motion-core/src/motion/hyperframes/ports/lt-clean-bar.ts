import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-clean-bar',
  title: 'Lower third, clean bar',
  about: 'White card lower third with an accent tab: the card wipes in from the left, the tab grows, name and role rise in.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-clean-bar',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Montserrat'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#ff5a36', group: 'Style' },
    card: { type: 'string', title: 'Card', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    nameColor: { type: 'string', title: 'Name colour', format: PropFormat.Color, default: '#0f1115', group: 'Style' },
    roleColor: { type: 'string', title: 'Role colour', format: PropFormat.Color, default: '#5a6170', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const font = 'Montserrat, sans-serif';
    const tab = S.h('div', { style: { width: 12, background: String(p.accent), flexShrink: 0 } }) as HTMLElement;
    const who = S.h('div', { style: { fontSize: 52, fontWeight: 700, color: String(p.nameColor), lineHeight: 1.06, letterSpacing: '-0.015em', whiteSpace: 'nowrap' } }, String(p.person)) as HTMLElement;
    const role = S.h('div', { style: { fontSize: 27, fontWeight: 400, color: String(p.roleColor), lineHeight: 1.2, letterSpacing: '0.01em', whiteSpace: 'nowrap' } }, String(p.role)) as HTMLElement;
    const body = S.h('div', { style: { background: String(p.card), padding: '22px 40px 24px 30px', display: 'flex', flexDirection: 'column', gap: 7 } }, who, role);
    const card = S.h('div', { style: { position: 'absolute', left: 120, bottom: 110, display: 'flex', alignItems: 'stretch', borderRadius: 16, overflow: 'hidden', boxShadow: '0 14px 44px rgba(15, 17, 21, 0.18)', fontFamily: font } }, tab, body) as HTMLElement;
    view.root.replaceChildren(card);

    const tl = S.timeline();
    tl.set(card, { clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.set(tab, { scaleY: 0, transformOrigin: '50% 0%' }, 0);
    tl.set([who, role], { y: 22, opacity: 0 }, 0);
    tl.to(card, { clipPath: 'inset(0 0% 0 0)', duration: 0.55, ease: 'power3.out' }, 0.1);
    tl.to(tab, { scaleY: 1, duration: 0.45, ease: 'power2.out' }, 0.28);
    tl.to(who, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.34);
    tl.to(role, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.44);
    tl.to(card, { y: 18, opacity: 0, duration: 0.35, ease: 'power2.in' }, 4.3);
    tl.set(card, { visibility: 'hidden' }, 4.75);

    return (frame) => tl.render(frame / view.fps);
  }
};
