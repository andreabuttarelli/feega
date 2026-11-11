import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'fade-through',
  title: 'Fade through',
  about: 'Two panels: the first fades out into a flat or glowing colour wash, then the second fades in out of it.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'fade-through',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 72,
  background: '#111827',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Outgoing label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'Incoming label', default: 'After', group: 'Content', maxLength: 40 },
    fromColor: { type: 'string', title: 'Outgoing panel', format: PropFormat.Color, default: '#2563eb', group: 'Style' },
    toColor: { type: 'string', title: 'Incoming panel', format: PropFormat.Color, default: '#7c3aed', group: 'Style' },
    wash: { type: 'string', title: 'Wash', enum: ['paper', 'white', 'ink', 'accent'], default: 'paper', group: 'Style' },
    strength: { type: 'number', title: 'Strength', default: 1, minimum: 0.1, maximum: 1, step: 0.05, group: 'Style' },
    shape: { type: 'string', title: 'Shape', enum: ['flat', 'bloom'], default: 'flat', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const washes: Record<string, string> = { paper: '#f8f5ec', white: '#ffffff', ink: '#0b0b0f', accent: '#38bdf8' };
    const colour = washes[String(p.wash)] ?? washes.paper;
    const strength = Math.min(1, Math.max(0.1, Number(p.strength) || 1));
    const paint = p.shape === 'bloom' ? `radial-gradient(circle at 50% 50%, ${colour} 0%, transparent 72%)` : colour;
    const scene = (background: string, label: string) => S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 146, letterSpacing: '-0.05em', color: '#ffffff', background }, label) as HTMLElement;

    const out = scene(String(p.fromColor), String(p.fromLabel));
    const inn = scene(String(p.toColor), String(p.toLabel));
    const wash = S.fill({ pointerEvents: 'none', background: paint, zIndex: 900 }) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, out, inn, wash));

    const tl = S.timeline();
    const at = 0.5;
    tl.set(inn, { opacity: 0 }, 0);
    tl.set(wash, { opacity: 0 }, 0);
    tl.to(out, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, at);
    tl.to(wash, { opacity: strength, duration: 0.35, ease: 'power2.inOut' }, at);
    tl.to(wash, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, at + 0.35);
    tl.to(inn, { opacity: 1, duration: 0.55, ease: 'power2.out' }, at + 0.35);

    return (frame) => tl.render(frame / view.fps);
  }
};
