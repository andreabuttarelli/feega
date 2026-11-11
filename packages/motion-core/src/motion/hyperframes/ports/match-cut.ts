import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'match-cut',
  title: 'Match cut',
  about: 'A circle button swells to fill the frame, then a hard cut lands on a matching circle with a check mark that shrinks back as the label appears.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'match-cut',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0b0f18',
  fonts: ['Inter'],
  props: {
    label_a: { type: 'string', title: 'Scene A label', default: 'Start', group: 'Content', maxLength: 24 },
    label_b: { type: 'string', title: 'Scene B label', default: 'Done', group: 'Content', maxLength: 40 },
    kicker: { type: 'string', title: 'Kicker', default: 'Match complete', group: 'Content', maxLength: 40 },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const accents: Record<string, string> = { green: '#4ade80', blue: '#60a5fa', violet: '#a78bfa' };
    const accent = accents[String(p.accent)] ?? accents.green;
    const unit = Math.min(view.width, view.height) / 100;
    const row = (extra: Record<string, unknown>, ...kids: unknown[]) => S.fill({ alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...extra }, ...(kids as Element[])) as HTMLElement;
    const circle = (...kids: unknown[]) => S.h('div', { style: { display: 'grid', placeItems: 'center', width: 32 * unit, height: 32 * unit, borderRadius: '50%', background: accent, boxShadow: `0 ${0.032 * view.height}px ${0.08 * view.height}px ${accent}4d`, transformOrigin: '50% 50%' } }, ...(kids as Element[])) as HTMLElement;

    const labelA = S.h('span', { style: { display: 'block', maxWidth: '78%', overflow: 'hidden', color: '#081018', fontSize: 5.2 * unit, fontWeight: 780, letterSpacing: '-0.035em', lineHeight: 1, textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, String(p.label_a));
    const circleA = circle(labelA);
    const check = S.h('span', { style: { width: '34%', height: '22%', borderLeft: `${2.4 * unit}px solid #081018`, borderBottom: `${2.4 * unit}px solid #081018`, transform: 'translateY(-8%) rotate(-45deg)' } });
    const circleB = circle(check);
    const kicker = S.h('span', { style: { color: '#e2fbe9', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 2.1 * unit, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' } }, String(p.kicker)) as HTMLElement;
    const labelB = S.h('span', { style: { display: 'block', maxWidth: 0.74 * view.width, overflow: 'hidden', color: '#f8fafc', fontSize: 6.8 * unit, fontWeight: 760, letterSpacing: '-0.04em', lineHeight: 1.05, textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, String(p.label_b)) as HTMLElement;
    const copy = S.h('div', { style: { position: 'absolute', top: '69%', left: 0.12 * view.width, right: 0.12 * view.width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.016 * view.height, textAlign: 'center' } }, kicker, labelB);
    const sceneA = row({ background: 'radial-gradient(circle at 50% 50%, #182032 0%, #0b0f18 68%)', fontFamily: 'Inter, system-ui, sans-serif' }, circleA);
    const sceneB = row({ background: 'radial-gradient(circle at 50% 44%, #202b42 0%, #0d121d 72%)', fontFamily: 'Inter, system-ui, sans-serif' }, circleB, copy);
    const shell = S.fill({ overflow: 'hidden' }, sceneA, sceneB) as HTMLElement;
    view.root.replaceChildren(shell);

    const duration = view.frames / view.fps;
    const inBase = 2.35;
    const outBase = 0.5;
    const phase = duration < inBase + outBase ? duration / (inBase + outBase) : 1;
    const inEnd = inBase * phase;
    const out = outBase * phase;
    const cut = 1.4 * phase;
    const approach = 0.45 * phase;
    const settle = 0.65 * phase;
    const hold = Math.max(0, duration - inEnd - out);
    const reveal = [kicker, labelB];

    const tl = S.timeline();
    tl.set(shell, { opacity: 0 }, 0);
    tl.set(sceneA, { opacity: 1 }, 0);
    tl.set(sceneB, { opacity: 0 }, 0);
    tl.set(circleA, { scale: 0.54 }, 0);
    tl.set(circleB, { scale: 1, y: 0 }, 0);
    tl.set(reveal, { opacity: 0, y: 0.024 * view.height }, 0);
    tl.to(shell, { opacity: 1, duration: Math.min(0.3, inEnd), ease: 'power2.out' }, 0);
    tl.to(circleA, { scale: 0.64, duration: approach, ease: 'power3.out' }, 0);
    tl.to(circleA, { scale: 1, duration: Math.max(0, cut - approach), ease: 'power4.in' }, approach);
    tl.set(sceneA, { opacity: 0 }, cut);
    tl.set(sceneB, { opacity: 1 }, cut);
    tl.to(circleB, { scale: 0.74, duration: settle, ease: 'power4.out' }, cut);
    tl.to(reveal, { opacity: 1, y: 0, duration: 0.55 * phase, stagger: 0.08 * phase, ease: 'power3.out' }, cut + 0.1 * phase);
    if (hold > 0) {
      tl.to(circleB, { y: -0.008 * view.height, duration: hold / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, inEnd);
    }
    tl.to(shell, { opacity: 0, duration: out, ease: 'power2.in' }, inEnd + hold);

    return (frame) => tl.render(frame / view.fps);
  }
};
