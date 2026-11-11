import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'kinetic-center-build',
  title: 'Kinetic center build',
  about: 'Words enter from the right one at a time and push the earlier words left, keeping the whole line centred.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 60,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Words push left.', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 400, maximum: 700, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    entryOffset: { type: 'number', title: 'Entry offset', default: 88, minimum: 20, maximum: 160, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fontSize = Number(p.fontSize);
    const entryOffset = Number(p.entryOffset);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const GAP = 10;
    const FIRST_FRAMES = 10;
    const PUSH_FRAMES = 13;
    const TRAVEL_FRAMES = 7;
    const ENTRY_SCALE = 0.992;
    const ENTRY_BLUR = 3.5;
    const REFLOW_BLUR = 0.8;
    const FIRST_WORD_Y = 6;
    const FALLBACK_WIDTH_RATIO = 0.55;
    const ease = S.Easing.bezier(0.2, 0.8, 0.2, 1);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const eased = { ...clamped, easing: ease };

    const words = String(p.text).split(' ');
    const total = words.length;
    const wordStyle = { fontSize, fontWeight: Number(p.fontWeight), fontFamily: face, whiteSpace: 'nowrap' };
    const rulers = words.map((word) => S.h('span', { style: { ...wordStyle, position: 'absolute', visibility: 'hidden' } }, word) as HTMLElement);
    const spans = words.map((word) => S.h('span', { style: { position: 'absolute', left: '50%', top: '50%', whiteSpace: 'nowrap', backfaceVisibility: 'hidden' } }, word) as HTMLElement);
    const line = S.h('div', { style: { position: 'relative', fontSize, fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face, whiteSpace: 'nowrap' } }, spans, rulers);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    const layouts = () => {
      const widths = words.map((word, i) => rulers[i].offsetWidth || word.length * fontSize * FALLBACK_WIDTH_RATIO);
      const out: number[][] = [];
      for (let k = 1; k <= total; k++) {
        let sum = GAP * (k - 1);
        for (let j = 0; j < k; j++) {
          sum += widths[j];
        }
        let cursor = -sum / 2;
        const xs: number[] = [];
        for (let j = 0; j < k; j++) {
          xs.push(cursor + widths[j] / 2);
          cursor += widths[j] + GAP;
        }
        out.push(xs);
      }
      return out;
    };

    return (at) => {
      const frame = at * speed;
      const positionsAt = layouts();

      spans.forEach((el, j) => {
        const entryStart = j === 0 ? 0 : FIRST_FRAMES + (j - 1) * PUSH_FRAMES;
        const entryEnd = entryStart + (j === 0 ? FIRST_FRAMES : PUSH_FRAMES);
        const targetX = positionsAt[j][j];
        const xFrom = j === 0 ? 0 : targetX + entryOffset;
        let x = targetX;
        let opacity = 1;
        let scale = 1;
        let blur = 0;
        let y = 0;

        if (frame < entryStart) {
          opacity = 0;
          x = xFrom;
          scale = ENTRY_SCALE;
          blur = ENTRY_BLUR;
          y = j === 0 ? FIRST_WORD_Y : 0;
        } else if (frame <= entryEnd) {
          const range = [entryStart, entryEnd];
          const travel = [entryStart, Math.min(entryStart + TRAVEL_FRAMES, entryEnd)];
          x = S.interpolate(frame, travel, [xFrom, targetX], eased);
          opacity = S.interpolate(frame, range, [0, 1], eased);
          scale = S.interpolate(frame, range, [ENTRY_SCALE, 1], eased);
          blur = S.interpolate(frame, range, [ENTRY_BLUR, 0], eased);
          y = j === 0 ? S.interpolate(frame, travel, [FIRST_WORD_Y, 0], eased) : 0;
        } else {
          for (let w = j + 1; w < total; w++) {
            const pushStart = FIRST_FRAMES + (w - 1) * PUSH_FRAMES;
            const pushEnd = pushStart + PUSH_FRAMES;
            const fromX = positionsAt[w - 1][j];
            const toX = positionsAt[w][j];

            if (frame >= pushEnd) {
              x = toX;
              continue;
            }

            if (frame >= pushStart) {
              x = S.interpolate(frame, [pushStart, Math.min(pushStart + TRAVEL_FRAMES, pushEnd)], [fromX, toX], eased);
              blur = S.interpolate(frame, [pushStart, (pushStart + pushEnd) / 2, pushEnd], [0, REFLOW_BLUR, 0], clamped);
              break;
            }

            x = fromX;
            break;
          }
        }

        el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        el.style.filter = `blur(${blur}px)`;
        el.style.opacity = String(opacity);
      });
    };
  }
};
