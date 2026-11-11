import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'rolling-number',
  title: 'Rolling number',
  about: 'Digit columns spin like a slot reel while a number counts from one value to another.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
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
    const p = view.props;
    const start = Math.max(0, Math.round(Number(p.from)));
    const end = Math.max(0, Math.round(Number(p.to)));
    const fontSize = Number(p.fontSize);
    const speed = Number(p.speed);
    const COUNT_PORTION = 0.8;
    const REVEAL_BAND = 0.4;
    const REVEAL_RISE_EM = 0.32;
    const cellHeight = fontSize * 1.1;
    const countEase = S.Easing.out(S.Easing.poly(4));
    const revealEase = S.Easing.inOut(S.Easing.sin);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const wrap10 = (v: number) => ((v % 10) + 10) % 10;

    const travelOf = (place: number) => {
      const pow = 10 ** place;
      const up = end >= start;
      const startDigit = Math.floor(start / pow) % 10;
      const finalDigit = Math.floor(end / pow) % 10;
      const fullTurns = Math.floor(Math.abs(end - start) / (pow * 10));
      const step = up ? (finalDigit - startDigit + 10) % 10 : (startDigit - finalDigit + 10) % 10;
      const magnitude = fullTurns * 10 + step;
      return up ? magnitude : -magnitude;
    };

    const digitCount = String(Math.max(start, end)).length;
    const columns = Array.from({ length: digitCount }, (_, place) => {
      const strip = S.h('span', { style: { display: 'flex', flexDirection: 'column' } }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => S.h('span', { style: { height: cellHeight, lineHeight: `${cellHeight}px` } }, String(d)))) as HTMLElement;
      const cell = S.h('span', { style: { display: 'inline-block', overflow: 'hidden', height: cellHeight, width: '0.62em', verticalAlign: 'top', textAlign: 'center' } }, strip) as HTMLElement;
      return { place, strip, cell, startDigit: Math.floor(start / 10 ** place) % 10, travel: travelOf(place) };
    });

    const cells: Element[] = [];
    columns.forEach((col) => {
      if (col.place > 0 && col.place % 3 === 0) {
        cells.unshift(S.h('span', { style: { display: 'inline-block', width: '0.34em', height: cellHeight } }));
      }
      cells.unshift(col.cell);
    });

    const row = S.h('div', { style: { display: 'flex', alignItems: 'flex-start', fontSize, fontWeight: 800, color: String(p.color), fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 } }, cells);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, row));

    return (at) => {
      const e = S.interpolate(at * speed, [0, view.frames * COUNT_PORTION], [0, 1], { ...clamped, easing: countEase });
      const current = start + e * (end - start);
      columns.forEach((col) => {
        const threshold = 10 ** col.place;
        const reveal = col.place === 0 ? 1 : S.interpolate(current, [threshold * REVEAL_BAND, threshold], [0, 1], { ...clamped, easing: revealEase });
        col.cell.style.opacity = String(reveal);
        col.cell.style.translate = `0 ${(1 - reveal) * fontSize * REVEAL_RISE_EM}px`;
        col.strip.style.translate = `0 ${-wrap10(col.startDigit + e * col.travel) * cellHeight}px`;
      });
    };
  }
};
