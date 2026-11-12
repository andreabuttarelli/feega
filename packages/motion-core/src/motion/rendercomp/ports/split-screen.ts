import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'split-screen',
  title: 'Split screen',
  about: 'Two contrasting panels wipe open from the centre with a snapping divider, then each heading and sub line rises into place.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0b1220',
  fonts: [],
  props: {
    headingA: { type: 'string', title: 'Panel A heading', default: 'Before', group: 'Content', maxLength: 30 },
    subA: { type: 'string', title: 'Panel A sub text', default: 'The old way', group: 'Content', maxLength: 60 },
    headingB: { type: 'string', title: 'Panel B heading', default: 'After', group: 'Content', maxLength: 30 },
    subB: { type: 'string', title: 'Panel B sub text', default: 'Powered by AI', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    direction: { type: 'string', title: 'Split direction', enum: ['horizontal', 'vertical'], default: 'horizontal', group: 'Style' },
    bgA: { type: 'string', title: 'Panel A background', format: PropFormat.Color, default: '#1f2937', group: 'Style' },
    textColorA: { type: 'string', title: 'Panel A text', format: PropFormat.Color, default: '#f1f5f9', group: 'Style' },
    bgB: { type: 'string', title: 'Panel B background', format: PropFormat.Color, default: '#0ea5e9', group: 'Style' },
    textColorB: { type: 'string', title: 'Panel B text', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    dividerColor: { type: 'string', title: 'Divider colour', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    dividerWidth: { type: 'number', title: 'Divider width (px)', default: 6, minimum: 0, maximum: 40, step: 1, group: 'Style' },
    backdropColor: { type: 'string', title: 'Backdrop', format: PropFormat.Color, default: '#0b1220', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE_OUT = S.Easing.out(S.Easing.ease);
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const DELAY = 6;
    const DURATION = 36;
    const HALF = DURATION / 2;
    const horizontal = String(p.direction) !== 'vertical';
    const dividerWidth = Number(p.dividerWidth);

    const panel = (heading: string, sub: string, bg: string, textColor: string) => {
      const headingEl = S.h('div', { style: { fontSize: 96, fontWeight: 900, color: textColor, letterSpacing: 4 } }, heading) as HTMLElement;
      const subEl = sub ? (S.h('div', { style: { fontSize: 32, fontWeight: 500, color: textColor } }, sub) as HTMLElement) : null;
      const content = S.h('div', { style: { width: '100%', height: '100%', backgroundColor: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: FONT } }, headingEl, subEl);
      return { content, headingEl, subEl };
    };
    const panelA = panel(String(p.headingA), String(p.subA), String(p.bgA), String(p.textColorA));
    const panelB = panel(String(p.headingB), String(p.subB), String(p.bgB), String(p.textColorB));

    const base = { position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } as const;
    const firstStyle = horizontal ? { ...base, top: 0, left: 0, width: '50%', height: '100%' } : { ...base, top: 0, left: 0, width: '100%', height: '50%' };
    const secondStyle = horizontal ? { ...base, top: 0, right: 0, width: '50%', height: '100%' } : { ...base, bottom: 0, left: 0, width: '100%', height: '50%' };
    const dividerStyle = horizontal
      ? { position: 'absolute', top: 0, left: '50%', width: dividerWidth, height: '100%', backgroundColor: String(p.dividerColor), transformOrigin: 'center', zIndex: 2 }
      : { position: 'absolute', left: 0, top: '50%', width: '100%', height: dividerWidth, backgroundColor: String(p.dividerColor), transformOrigin: 'center', zIndex: 2 };

    const first = S.h('div', { style: firstStyle }, panelA.content) as HTMLElement;
    const second = S.h('div', { style: secondStyle }, panelB.content) as HTMLElement;
    const divider = S.h('div', { style: dividerStyle }) as HTMLElement;
    const stage = S.h('div', { style: { position: 'relative', width: '100%', height: '100%' } }, first, divider, second);

    const wash = S.fill({ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 68%)' });
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backdropColor) }, wash, stage));

    const rise = (frame: number, start: number, heading: HTMLElement, sub: HTMLElement | null) => {
      const opacity = S.interpolate(frame, [start, start + 14], [0, 1], { ...clamped, easing: CUBIC_OUT });
      const y = S.interpolate(frame, [start, start + 14], [24, 0], { ...clamped, easing: CUBIC_OUT });
      heading.style.opacity = String(opacity);
      heading.style.transform = `translateY(${y}px)`;
      if (sub) {
        sub.style.opacity = String(opacity * 0.85);
      }
    };

    return (frame) => {
      const firstProgress = S.interpolate(frame, [DELAY, DELAY + HALF], [0, 1], { ...clamped, easing: EASE_OUT });
      const secondProgress = S.interpolate(frame, [DELAY + HALF, DELAY + DURATION], [0, 1], { ...clamped, easing: EASE_OUT });
      const dividerOpacity = S.interpolate(frame, [DELAY + HALF - 3, DELAY + HALF + 3], [0, 1], clamped);
      const dividerScale = S.interpolate(frame, [DELAY + HALF - 3, DELAY + HALF + 6], [0, 1], { ...clamped, easing: EASE_OUT });

      first.style.clipPath = horizontal ? `inset(0 ${(1 - firstProgress) * 50}% 0 0)` : `inset(0 0 ${(1 - firstProgress) * 50}% 0)`;
      second.style.clipPath = horizontal ? `inset(0 0 0 ${(1 - secondProgress) * 50}%)` : `inset(${(1 - secondProgress) * 50}% 0 0 0)`;
      divider.style.opacity = String(dividerOpacity);
      divider.style.transform = horizontal ? `translateX(-50%) scaleY(${dividerScale})` : `translateY(-50%) scaleX(${dividerScale})`;

      rise(frame, 22, panelA.headingEl, panelA.subEl);
      rise(frame, 40, panelB.headingEl, panelB.subEl);
    };
  }
};
