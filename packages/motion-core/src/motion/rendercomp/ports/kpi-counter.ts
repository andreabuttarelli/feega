import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'kpi-counter',
  title: 'KPI counter',
  about: 'Metric cards slide in on a stagger while their figures count up on rolling odometer digit drums that lock in one column at a time.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0f172a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Q4 Results', group: 'Content', maxLength: 60 },
    subtitle: { type: 'string', title: 'Subtitle', default: '2024 Performance', group: 'Content', maxLength: 80 },
    metrics: {
      type: 'string',
      title: 'Metrics (label;value;prefix;suffix;dec;colour;icon)',
      default: 'Revenue;2840000;$;;0;#22c55e;+ | Growth;127;+;%;0;#6366f1;^ | Clients;384;;;0;#f59e0b;# | NPS Score;72;;;0;#ec4899;★',
      group: 'Content',
      maxLength: 800
    },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    cardColor: { type: 'string', title: 'Card colour', format: PropFormat.Color, default: '#1e293b', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' },
    subtextColor: { type: 'string', title: 'Subtext colour', format: PropFormat.Color, default: '#94a3b8', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#6366f1', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const textColor = String(p.textColor);
    const subtextColor = String(p.subtextColor);
    const accent = String(p.accentColor);
    const scale = Math.min(view.width, view.height);
    const cols = view.width > view.height ? 4 : 2;
    const CARD_DELAY = 14;
    const CARD_STAGGER = 8;
    const CELL_RATIO = 1.2;
    const WIDTH_RATIO = 0.62;
    const MASK = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';
    const fontSize = scale * 0.072;
    const cell = fontSize * CELL_RATIO;

    const metrics = String(p.metrics)
      .split('|')
      .map((row) => row.split(';').map((c) => c.trim()))
      .filter((c) => c[0])
      .map((c) => ({ label: c[0], value: Number(c[1]) || 0, prefix: c[2] ?? '', suffix: c[3] ?? '', decimals: Math.max(0, Math.round(Number(c[4]) || 0)), color: c[5] || accent, icon: c[6] ?? '' }));

    const formatFor = (value: number, decimals: number) => {
      if (value >= 1_000_000) {
        return { div: 1_000_000, unit: 'M', dec: decimals > 0 ? decimals : 1 };
      }
      if (value >= 1_000) {
        return { div: 1_000, unit: 'K', dec: decimals > 0 ? decimals : 1 };
      }
      return { div: 1, unit: '', dec: decimals };
    };

    const wheelPos = (value: number, place: number) => {
      const q = Math.max(0, value) / 10 ** place;
      const whole = Math.floor(q);
      const frac = q - whole;
      const carry = place === 0 ? frac : Math.min(1, Math.max(0, frac * 10 - 9));
      return (whole % 10) + carry;
    };

    const staticCell = (text: string, extra: Record<string, string | number>) =>
      S.h('span', { style: { display: 'inline-block', height: cell, lineHeight: `${cell}px`, ...extra } }, text);

    const cards = metrics.map((m) => {
      const fmt = formatFor(m.value, m.decimals);
      const targetUnits = Math.round((m.value / fmt.div) * 10 ** fmt.dec);
      const template = (targetUnits / 10 ** fmt.dec).toFixed(fmt.dec);
      const digitCount = template.replace(/[^0-9]/g, '').length;

      let digitIndex = 0;
      const drums: { strip: HTMLElement; place: number }[] = [];
      const parts = template.split('').map((char) => {
        if (char < '0' || char > '9') {
          return staticCell(char, { width: fontSize * 0.26, textAlign: 'center', color: textColor });
        }
        const place = digitCount - 1 - digitIndex;
        digitIndex += 1;
        const strip = S.h(
          'span',
          { style: { position: 'absolute', top: 0, left: 0, width: '100%' } },
          Array.from({ length: 11 }, (_, i) => S.h('span', { style: { display: 'block', height: cell, lineHeight: `${cell}px`, textAlign: 'center', color: textColor, fontVariantNumeric: 'tabular-nums' } }, String(i % 10)))
        ) as HTMLElement;
        drums.push({ strip, place });
        return S.h('span', { style: { display: 'inline-block', position: 'relative', overflow: 'hidden', width: fontSize * WIDTH_RATIO, height: cell, maskImage: MASK, WebkitMaskImage: MASK } }, strip);
      });
      const number = S.h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, parts, fmt.unit ? staticCell(fmt.unit, { color: textColor }) : null);

      const accentBar = S.h('div', { style: { position: 'absolute', left: 0, top: scale * 0.14 * 0.15, bottom: scale * 0.14 * 0.15, width: scale * 0.007, backgroundColor: m.color, borderRadius: scale * 0.004, transform: 'scaleY(0)', transformOrigin: 'bottom center' } }) as HTMLElement;
      const affix = (text: string) => (text ? S.h('span', { style: { fontSize: scale * 0.042, fontWeight: 600, color: m.color } }, text) : null);

      const card = S.h(
        'div',
        { style: { backgroundColor: String(p.cardColor), borderRadius: scale * 0.022, padding: scale * 0.025, opacity: 0, position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' } },
        accentBar,
        S.h(
          'div',
          { style: { paddingLeft: scale * 0.022, display: 'flex', flexDirection: 'column', gap: scale * 0.008 } },
          S.h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: scale * 0.01 } },
            S.h('span', { style: { fontFamily: face, fontSize: scale * 0.025, color: m.color, fontWeight: 700 } }, m.icon),
            S.h('span', { style: { fontFamily: face, fontSize: scale * 0.027, fontWeight: 500, color: subtextColor, letterSpacing: 0.5, textTransform: 'uppercase' } }, m.label)
          ),
          S.h('div', { style: { fontFamily: face, fontSize, fontWeight: 800, color: textColor, letterSpacing: -1.5, lineHeight: 1, display: 'flex', alignItems: 'center', gap: scale * 0.006 } }, affix(m.prefix), number, affix(m.suffix))
        )
      ) as HTMLElement;

      return { card, accentBar, drums, targetUnits };
    });

    const titleBlock = S.h(
      'div',
      { style: { textAlign: 'center', width: '100%', opacity: 0 } },
      S.h('div', { style: { fontFamily: face, fontSize: scale * 0.07, fontWeight: 800, color: textColor, letterSpacing: -1 } }, String(p.title)),
      String(p.subtitle) ? S.h('div', { style: { fontFamily: face, fontSize: scale * 0.033, fontWeight: 400, color: subtextColor, marginTop: scale * 0.008 } }, String(p.subtitle)) : null
    ) as HTMLElement;
    const separator = S.h('div', { style: { width: 0, height: 2, backgroundColor: accent, borderRadius: 2, opacity: 0.6 } }) as HTMLElement;

    view.root.replaceChildren(
      S.fill(
        { backgroundColor: String(p.backgroundColor), alignItems: 'center', justifyContent: 'center', padding: scale * 0.06, gap: scale * 0.04 },
        S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 50% 0%, ${accent}18 0%, transparent 60%)`, pointerEvents: 'none' } }),
        titleBlock,
        separator,
        S.h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: scale * 0.022, width: '100%' } }, cards.map((c) => c.card))
      )
    );

    return (frame) => {
      const titleIn = S.spring({ frame, fps: view.fps, config: { damping: 14, stiffness: 80 }, durationInFrames: 18 });
      titleBlock.style.opacity = String(titleIn);
      titleBlock.style.transform = `translateY(${S.interpolate(titleIn, [0, 1], [-20, 0])}px)`;
      separator.style.width = `${scale * 0.35 * S.interpolate(frame, [10, 28], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.quad) })}px`;

      cards.forEach((c, i) => {
        const delay = CARD_DELAY + i * CARD_STAGGER;
        const cardIn = S.spring({ frame: frame - delay, fps: view.fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, durationInFrames: 22 });
        c.card.style.opacity = String(Math.min(cardIn * 1.5, 1));
        c.card.style.transform = `translateX(${S.interpolate(cardIn, [0, 1], [-40, 0])}px)`;

        const countStart = delay + 6;
        const countEnd = delay + 55;
        const progress = S.interpolate(frame, [countStart, countEnd], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) });
        const barProgress = S.interpolate(frame, [countStart, countEnd + 8], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.quad) });
        c.accentBar.style.transform = `scaleY(${barProgress})`;

        const value = c.targetUnits * progress;
        c.drums.forEach((d) => {
          const wheel = ((wheelPos(value, d.place) % 10) + 10) % 10;
          d.strip.style.transform = `translateY(${-wheel * cell}px)`;
        });
      });
    };
  }
};
