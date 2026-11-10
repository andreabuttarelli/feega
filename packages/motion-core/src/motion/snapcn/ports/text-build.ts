import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-build',
  title: 'Text build',
  about: 'Words arrive one by one and push the line, reflowing it centred with a soft blur.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 75,
  background: '#faf9f6',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'Ship faster with Acme', group: 'Content', maxLength: 120 },
    axis: { type: 'string', title: 'Build direction', enum: ['x', 'y'], default: 'x', group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    entryOffset: { type: 'number', title: 'Entry offset (px, 0 = default)', default: 0, minimum: 0, maximum: 400, step: 1, group: 'Motion' },
    gap: { type: 'number', title: 'Gap (px, 0 = default)', default: 0, minimum: 0, maximum: 200, step: 1, group: 'Style' },
    firstDuration: { type: 'number', title: 'First word (frames)', default: 10, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    pushDuration: { type: 'number', title: 'Push step (frames)', default: 13, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    entryScale: { type: 'number', title: 'Entry scale', default: 0.992, minimum: 0.5, maximum: 1.5, step: 0.001, group: 'Motion' },
    entryBlur: { type: 'number', title: 'Entry blur (px, 0 = default)', default: 0, minimum: 0, maximum: 20, step: 0.1, group: 'Motion' },
    reflowBlur: { type: 'number', title: 'Reflow blur (px)', default: 0.8, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const axis = p.axis === 'y' ? 'y' : 'x';
    const DEFAULTS = { x: { entryOffset: 88, gap: 10, entryBlur: 3.5, firstDrift: 6 }, y: { entryOffset: 28, gap: 12, entryBlur: 2.4, firstDrift: -14 } }[axis];
    const fontSize = Number(p.fontSize);
    const fontWeight = Number(p.fontWeight);
    const offset = Number(p.entryOffset) || DEFAULTS.entryOffset;
    const spacing = Number(p.gap) || DEFAULTS.gap;
    const inBlur = Number(p.entryBlur) || DEFAULTS.entryBlur;
    const firstDuration = Number(p.firstDuration);
    const pushDuration = Number(p.pushDuration);
    const entryScale = Number(p.entryScale);
    const reflowBlur = Number(p.reflowBlur);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif');
    const ease = S.Easing.bezier(0.2, 0.8, 0.2, 1);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const words = String(p.text).split(' ');
    const n = words.length;

    const spans = words.map((word) => S.h('span', { style: { position: 'absolute', left: '50%', top: '50%', whiteSpace: 'nowrap' } }, word) as HTMLElement);
    const line = S.h('div', { style: { position: 'relative', fontSize, fontWeight, color: S.pick(p.color, String(t.foreground)), letterSpacing: '-0.03em', fontFamily: face, whiteSpace: 'nowrap' } }, spans);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, line));

    const measure = () => {
      if (axis === 'y') {
        return words.map(() => fontSize);
      }
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) {
        return words.map((w) => w.length * fontSize * 0.55);
      }
      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      return words.map((w) => ctx.measureText(w).width);
    };

    const layouts = (sizes: number[]) => {
      const out: number[][] = [];
      for (let k = 1; k <= sizes.length; k++) {
        let total = spacing * (k - 1);
        for (let j = 0; j < k; j++) {
          total += sizes[j];
        }
        let cursor = -total / 2;
        const centers: number[] = [];
        for (let j = 0; j < k; j++) {
          centers.push(cursor + sizes[j] / 2);
          cursor += sizes[j] + spacing;
        }
        out.push(centers);
      }
      return out;
    };

    const placed = (frame: number, j: number, at: number[][]) => {
      for (let w = j + 1; w < n; w++) {
        const pushStart = firstDuration + (w - 1) * pushDuration;
        const pushEnd = pushStart + pushDuration;
        if (frame >= pushEnd) {
          continue;
        }
        if (frame < pushStart) {
          return { primary: at[w - 1][j], blur: 0 };
        }
        return {
          primary: S.interpolate(frame, [pushStart, pushEnd], [at[w - 1][j], at[w][j]], { ...clamped, easing: ease }),
          blur: S.interpolate(frame, [pushStart, (pushStart + pushEnd) / 2, pushEnd], [0, reflowBlur, 0], clamped)
        };
      }
      return { primary: at[n - 1][j], blur: 0 };
    };

    const stateOf = (frame: number, j: number, at: number[][]) => {
      const entryStart = j === 0 ? 0 : firstDuration + (j - 1) * pushDuration;
      const entryEnd = entryStart + (j === 0 ? firstDuration : pushDuration);
      const target = at[j][j];
      const primaryFrom = j === 0 ? (axis === 'y' ? target + DEFAULTS.firstDrift : target) : axis === 'y' ? target - offset : target + offset;
      const crossFrom = j === 0 && axis === 'x' ? DEFAULTS.firstDrift : 0;
      if (frame < entryStart) {
        return { primary: primaryFrom, cross: crossFrom, opacity: 0, scale: entryScale, blur: inBlur };
      }
      if (frame <= entryEnd) {
        const o = { ...clamped, easing: ease };
        const r = [entryStart, entryEnd];
        return { primary: S.interpolate(frame, r, [primaryFrom, target], o), cross: S.interpolate(frame, r, [crossFrom, 0], o), opacity: S.interpolate(frame, r, [0, 1], o), scale: S.interpolate(frame, r, [entryScale, 1], o), blur: S.interpolate(frame, r, [inBlur, 0], o) };
      }
      return { ...placed(frame, j, at), cross: 0, opacity: 1, scale: 1 };
    };

    return (f) => {
      const frame = f * speed;
      const at = layouts(measure());
      spans.forEach((el, j) => {
        const s = stateOf(frame, j, at);
        const tx = axis === 'x' ? s.primary : 0;
        const ty = axis === 'x' ? s.cross : s.primary;
        el.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${s.scale})`;
        el.style.filter = `blur(${s.blur}px)`;
        el.style.opacity = String(s.opacity);
      });
    };
  }
};
