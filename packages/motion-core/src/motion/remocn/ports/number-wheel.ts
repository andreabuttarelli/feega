import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'number-wheel',
  title: 'Number wheel',
  about: 'An odometer counter whose digits roll over with a spring as the value climbs, commas included.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 112,
  background: '#ffffff',
  fonts: ['JetBrains Mono'],
  props: {
    from: { type: 'number', title: 'From', default: 0, minimum: 0, step: 1, group: 'Content' },
    to: { type: 'number', title: 'To', default: 24813, minimum: 0, step: 1, group: 'Content' },
    fontSize: { type: 'number', title: 'Font size', default: 120, minimum: 24, maximum: 280, step: 4, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const grouped = (n: number, decimals = 0, useGrouping = true) => {
      const [whole, fraction] = n.toFixed(decimals).split('.');
      const text = useGrouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
      return fraction ? `${text}.${fraction}` : text;
    };
    const p = view.props;
    const start = Math.max(0, Math.round(Number(p.from)));
    const end = Math.max(0, Math.round(Number(p.to)));
    const fontSize = Number(p.fontSize);
    const speed = Number(p.speed);
    const WHEEL_ROLL_START = 0.9;
    const SPRING_FRAMES = 30;
    const SPRING = { damping: 200, stiffness: 100, mass: 1 };
    const COUNT_PORTION = 0.8;
    const cellHeight = fontSize * 1.1;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const springAtEnd = S.spring({ frame: SPRING_FRAMES, fps: view.fps, config: SPRING });
    const springEased = (t: number) => S.spring({ frame: t * SPRING_FRAMES, fps: view.fps, config: SPRING }) / springAtEnd;

    const wheelOf = (current: number, place: number) => {
      if (current <= 0) {
        return 0;
      }
      if (place === 0) {
        return current % 10;
      }
      const v = current / 10 ** place;
      const frac = v - Math.floor(v);
      const digit = Math.floor(v) % 10;
      if (frac <= WHEEL_ROLL_START) {
        return digit;
      }
      return digit + springEased((frac - WHEEL_ROLL_START) / (1 - WHEEL_ROLL_START));
    };

    const template = grouped(Math.max(start, end));
    const cells: { el: HTMLElement; strip: HTMLElement | null; place: number }[] = [];
    let place = 0;
    for (let i = template.length - 1; i >= 0; i--) {
      if (template[i] === ',') {
        const comma = S.h('span', { style: { display: 'inline-block', width: '0.32em', color: 'currentColor', fontSize: '0.85em', textAlign: 'center' } }, ',') as HTMLElement;
        cells.unshift({ el: comma, strip: null, place });
        continue;
      }
      const strip = S.h('span', { style: { display: 'flex', flexDirection: 'column' } }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => S.h('span', { style: { height: cellHeight, lineHeight: `${cellHeight}px` } }, String(d)))) as HTMLElement;
      const cell = S.h('span', { style: { display: 'inline-block', overflow: 'hidden', height: cellHeight, width: '0.62em', verticalAlign: 'top', textAlign: 'center' } }, strip) as HTMLElement;
      cells.unshift({ el: cell, strip, place });
      place++;
    }

    const row = S.h('div', { style: { display: 'flex', alignItems: 'baseline', fontSize, fontWeight: 800, color: String(p.color), fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 } }, cells.map((c) => c.el));
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, row));

    return (at) => {
      const progress = S.interpolate(at * speed, [0, view.frames * COUNT_PORTION], [0, 1], { ...clamped, easing: S.Easing.bezier(0.5, 1, 0.5, 1) });
      const current = Math.max(0, start + progress * (end - start));
      cells.forEach((cell) => {
        const threshold = 10 ** cell.place;
        const opacity = cell.place === 0 ? 1 : S.interpolate(current, [threshold * 0.9, threshold], [0, 1], clamped);
        cell.el.style.opacity = String(opacity);
        if (cell.strip) {
          cell.strip.style.translate = `0 ${-wheelOf(current, cell.place) * cellHeight}px`;
        }
      });
    };
  }
};
