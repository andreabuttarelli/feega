import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'zoom-through-transition',
  title: 'Zoom through',
  about: 'Two panels: the second wipes in through the first, which drifts back and blurs, with a sheen and a red-cyan flicker.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'zoom-through-transition',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#111827',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Outgoing label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'Incoming label', default: 'Zoom Through Transition', group: 'Content', maxLength: 40 },
    depth: { type: 'string', title: 'Depth', enum: ['close', 'standard', 'far'], default: 'standard', group: 'Motion' },
    fromColor: { type: 'string', title: 'Outgoing panel', format: PropFormat.Color, default: '#242b38', group: 'Style' },
    toColor: { type: 'string', title: 'Incoming panel', format: PropFormat.Color, default: '#3c424e', group: 'Style' },
    accent: { type: 'string', title: 'Ring colour', format: PropFormat.Color, default: '#6b7280', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const unit = view.height / 100;
    const k = view.width / 760;
    const depths: Record<string, number> = { close: 0.55, standard: 1, far: 1.7 };
    const depth = depths[String(p.depth)] ?? 1;
    const stripes = (alpha: number, color: string) => `repeating-linear-gradient(90deg, rgba(255, 255, 255, ${alpha}) 0px 1px, transparent 1px 4px), ${color}`;
    const scene = (extra: Record<string, unknown>, label: string) => S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 13.5 * unit, letterSpacing: '-0.05em', color: '#ffffff', ...extra }, label) as HTMLElement;

    const from = scene({ background: stripes(0.04, String(p.fromColor)) }, String(p.fromLabel));
    const to = scene({ background: stripes(0.05, String(p.toColor)), boxShadow: `inset 0 0 0 2px ${String(p.accent)}` }, String(p.toLabel));
    const fx = S.fill({ background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent)', mixBlendMode: 'screen' }) as HTMLElement;
    const rgb = S.fill({ pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.35), transparent, rgba(34, 211, 238, 0.35))' }) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden', background: '#111827' }, from, to, fx, rgb));

    const tl = S.timeline();
    const push = 0.9;
    const at = 0.35;
    tl.set(to, { clipPath: 'inset(0% 100% 0% 0%)', x: 60 * k * depth, scale: 1.04 }, 0);
    tl.set(from, { x: 0, scale: 1, filter: 'blur(0px)' }, 0);
    tl.set(fx, { xPercent: -110 }, 0);
    tl.set(rgb, { opacity: 0, x: -16 * k }, 0);
    tl.to(to, { clipPath: 'inset(0% 0% 0% 0%)', x: 0, scale: 1, duration: push, ease: 'power3.inOut' }, at);
    tl.to(from, { x: -70 * k * depth, scale: 0.96, filter: `blur(${5 * k * depth}px)`, duration: push, ease: 'power3.inOut' }, at);
    tl.to(fx, { xPercent: 110, duration: 0.58, ease: 'power2.inOut' }, at + 0.18);
    tl.to(rgb, { opacity: 1, x: 16 * k, repeat: 3, yoyo: true, duration: 0.07, ease: 'steps(1)' }, at + 0.32);

    return (frame) => tl.render(frame / view.fps);
  }
};
