import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'chromatic-aberration-wipe',
  title: 'Chromatic aberration wipe',
  about: 'Two panels: the second wipes in from a chosen side while a red-cyan channel split flickers across the edge.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'chromatic-aberration-wipe',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 72,
  background: '#111827',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Outgoing label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'Incoming label', default: 'Chromatic Aberration Wipe', group: 'Content', maxLength: 40 },
    direction: { type: 'string', title: 'Direction', enum: ['left', 'right', 'up', 'down'], default: 'left', group: 'Motion' },
    accent: { type: 'string', title: 'Accent', enum: ['blue', 'green', 'violet'], default: 'blue', group: 'Style' },
    aberration: { type: 'number', title: 'Aberration', default: 1, minimum: 0, maximum: 2, step: 0.1, group: 'Style' },
    fromColor: { type: 'string', title: 'Outgoing panel start', format: PropFormat.Color, default: '#111827', group: 'Style' },
    fromEnd: { type: 'string', title: 'Outgoing panel end', format: PropFormat.Color, default: '#374151', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const k = view.width / 760;
    const dirs: Record<string, number[]> = { left: [1, 0, 0, 1, 0, 0], right: [-1, 0, 0, 0, 0, 1], up: [0, 1, 1, 0, 0, 0], down: [0, -1, 0, 0, 1, 0] };
    const accents: Record<string, string[]> = { blue: ['#2563eb', '#7c3aed'], green: ['#047857', '#34d399'], violet: ['#6d28d9', '#a78bfa'] };
    const [ax, ay, t, r, b, l] = dirs[String(p.direction)] ?? dirs.left;
    const [sceneA, sceneB] = accents[String(p.accent)] ?? accents.blue;
    const strength = Math.min(2, Math.max(0, Number(p.aberration) || 0));
    const inset = (v: number) => `inset(${t * v}% ${r * v}% ${b * v}% ${l * v}%)`;
    const scene = (extra: Record<string, unknown>, label: string) => S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 58 * k, letterSpacing: '-0.05em', color: '#ffffff', ...extra }, label) as HTMLElement;

    const from = scene({ background: `linear-gradient(135deg, ${String(p.fromColor)}, ${String(p.fromEnd)})` }, String(p.fromLabel));
    const to = scene({ background: `linear-gradient(135deg, ${sceneA}, ${sceneB})` }, String(p.toLabel));
    const fx = S.fill({ background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent)', mixBlendMode: 'screen' }) as HTMLElement;
    const rgb = S.fill({ pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.35), transparent, rgba(34, 211, 238, 0.35))' }) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden', borderRadius: 30 * k, background: '#111827' }, from, to, fx, rgb));

    const tl = S.timeline();
    const at = 0.5;
    tl.set(to, { clipPath: inset(100), x: 60 * k * ax, y: 60 * k * ay, scale: 1.04 }, 0);
    tl.set(from, { x: 0, y: 0, scale: 1, filter: 'blur(0px)' }, 0);
    tl.set(fx, { xPercent: -110 }, 0);
    tl.set(rgb, { opacity: 0, x: -16 * k * strength }, 0);
    tl.to(to, { clipPath: inset(0), x: 0, y: 0, scale: 1, duration: 0.9, ease: 'power3.inOut' }, at);
    tl.to(from, { x: -70 * k * ax, y: -70 * k * ay, scale: 0.96, filter: `blur(${5 * k}px)`, duration: 0.9, ease: 'power3.inOut' }, at);
    tl.to(fx, { xPercent: 110, duration: 0.58, ease: 'power2.inOut' }, at + 0.18);
    tl.to(rgb, { opacity: strength, x: 16 * k * strength, repeat: 3, yoyo: true, duration: 0.07, ease: 'steps(1)' }, at + 0.32);

    return (frame) => tl.render(frame / view.fps);
  }
};
