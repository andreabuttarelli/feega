import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'toggle-flip',
  title: 'Toggle flip',
  about: 'A large switch squeezes slightly, then its knob slides across with a small overshoot while the track changes colour and glows.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'toggle-flip',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0b1120',
  fonts: ['Inter'],
  props: {
    direction: { type: 'string', title: 'Flip direction', enum: ['on', 'off'], default: 'on', group: 'Content' },
    label: { type: 'string', title: 'Caption', default: 'Auto-save', group: 'Content', maxLength: 60 },
    size: { type: 'number', title: 'Size', default: 40, minimum: 20, maximum: 70, group: 'Layout' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const OFF_TRACK = '#1e293b';
    const ON_TRACK = '#22c55e';
    const OFF_EDGE = '#334155';
    const ON_EDGE = 'rgb(44, 118, 89)';
    const toOn = p.direction !== 'off';
    const label = p.label == null ? '' : String(p.label);
    const pct = Math.max(20, Math.min(70, Number(p.size) || 40));
    const unit = (pct * W) / 100;
    const knobW = unit * 0.3636;
    const travel = knobW * 1.5;

    const glow = S.h('span', { style: { position: 'absolute', top: '-14%', left: '-14%', right: '-14%', bottom: '-14%', borderRadius: 999, background: 'radial-gradient(closest-side, rgba(56, 189, 248, 0.55), transparent 72%)' } }) as HTMLElement;
    const track = S.h('span', { style: { position: 'absolute', inset: 0, borderRadius: 999, border: `${W * 0.0015}px solid ${toOn ? OFF_EDGE : ON_EDGE}`, background: toOn ? OFF_TRACK : ON_TRACK, boxShadow: 'inset 0 0 0 1px rgba(51, 65, 85, 0.45)' } }) as HTMLElement;
    const knob = S.h('span', { style: { position: 'absolute', top: unit * 0.0455, left: unit * 0.0455, width: knobW, height: knobW, borderRadius: '50%', background: '#f8fafc', boxShadow: `0 ${W * 0.0035}px ${W * 0.007}px rgba(2, 6, 23, 0.4)` } }) as HTMLElement;
    const toggle = S.h('div', { style: { position: 'relative', display: 'block', width: unit, height: unit / 2.2 } }, glow, track, knob) as HTMLElement;
    const caption = S.h('div', { style: { display: label ? 'block' : 'none', color: '#94a3b8', fontSize: 28, fontWeight: 650, letterSpacing: '0.01em', textAlign: 'center' } }, label);
    const stage = S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: H * 0.03 } }, caption, toggle) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Inter, system-ui, sans-serif' } }, stage);
    view.root.replaceChildren(clip);

    const IN = 0.9;
    const OUT = 0.5;
    const FLIP_AT = 0.5;
    const FLIP_FOR = 0.25;
    const GLOW_FOR = 0.15;
    const PRESS_LEAD = 0.2;
    const SHEEN_HALF = 0.75;
    const duration = view.frames / view.fps;
    const hold = Math.max(0, duration - IN - OUT);
    const trackTo = toOn ? { backgroundColor: ON_TRACK, borderColor: ON_EDGE } : { backgroundColor: OFF_TRACK, borderColor: OFF_EDGE };

    const tl = S.timeline();
    tl.set(stage, { opacity: 0 }, 0);
    tl.set(toggle, { scaleX: 1, scaleY: 1 }, 0);
    tl.set(knob, { x: toOn ? 0 : travel, scale: 1 }, 0);
    tl.set(glow, { opacity: 0 }, 0);
    tl.to(stage, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0);
    tl.to(toggle, { scaleX: 0.94, scaleY: 1.06, duration: PRESS_LEAD / 2, ease: 'power1.inOut' }, FLIP_AT - PRESS_LEAD);
    tl.to(toggle, { scaleX: 1, scaleY: 1, duration: PRESS_LEAD / 2, ease: 'power1.inOut' }, FLIP_AT - PRESS_LEAD / 2);
    tl.to(knob, { x: toOn ? travel : 0, duration: FLIP_FOR, ease: 'back.out(1.9)' }, FLIP_AT);
    tl.to(track, { ...trackTo, duration: FLIP_FOR, ease: 'back.out(1.9)' }, FLIP_AT);
    tl.fromTo(knob, { scale: 1 }, { scale: 1.08, duration: FLIP_FOR * 0.45, ease: 'power1.out', yoyo: true, repeat: 1 }, FLIP_AT);
    tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: GLOW_FOR * 0.5, ease: 'power1.out', yoyo: true, repeat: 1 }, FLIP_AT + FLIP_FOR);

    if (hold > SHEEN_HALF) {
      tl.fromTo(glow, { opacity: 0 }, { opacity: 0.32, duration: SHEEN_HALF, ease: 'sine.inOut', yoyo: true, repeat: Math.max(0, Math.floor(hold / SHEEN_HALF) - 1) }, IN + GLOW_FOR);
    }
    tl.to(stage, { opacity: 0, duration: OUT, ease: 'power2.out' }, IN + hold);

    return (frame) => tl.render(frame / view.fps);
  }
};
