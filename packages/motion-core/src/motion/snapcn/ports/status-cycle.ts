import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'status-cycle',
  title: 'Status cycle',
  about: 'A prefix springs in beside a pill that rolls through statuses, then the line lifts away and chips scroll up.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 198,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    prefix: { type: 'string', title: 'Prefix', default: 'feega is', group: 'Content', maxLength: 60 },
    statuses: { type: 'string', title: 'Statuses, comma separated', default: 'animating, transitioning, rendering a scene, installed', group: 'Content', maxLength: 400 },
    chips: { type: 'string', title: 'Chips, comma separated', default: 'text-reveal, phone-frame, answer-stream, word-flip, orbit-gallery', group: 'Content', maxLength: 400 },
    fieldColor: { type: 'string', title: 'Field (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    pageColor: { type: 'string', title: 'Page (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    pillColor: { type: 'string', title: 'Pill (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    pillLabelColor: { type: 'string', title: 'Pill label (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    prefixColor: { type: 'string', title: 'Prefix (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    chipTextColor: { type: 'string', title: 'Chip text (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    chipBorderColor: { type: 'string', title: 'Chip border (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 400, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    chipFontWeight: { type: 'number', title: 'Chip font weight', default: 400, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    statusHold: { type: 'number', title: 'Status hold (frames)', default: 30, minimum: 4, maximum: 120, step: 1, group: 'Motion' },
    introFrames: { type: 'number', title: 'Intro (frames)', default: 24, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    chipStagger: { type: 'number', title: 'Chip stagger (frames)', default: 8, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const PILL_H = 1.128;
    const PILL_CY = 0.5164;
    const PILL_R = 0.229;
    const PILL_PAD = 0.19;
    const PILL_GAP = 0.147;
    const ACT1_EM = 0.087;
    const ACT2_EM = 0.222;
    const CHIP_PAD_X = 0.42;
    const CHIP_PAD_Y = 0.165;
    const CHIP_R = 0.162;
    const CHIP_BORDER = 0.017;
    const CHIP_INSET = 0.04;
    const ACT1_FIT = 0.92;
    const CHIP_GAP = 0.057;
    const WIDTH_EASE = S.Easing.bezier(0.65, 0.2, 0.3, 1.5);
    const WIDTH_SECONDS = 0.6;
    const ROLL_EASE = S.Easing.bezier(0.45, 0, 0.55, 1);
    const ROLL_SECONDS = 0.5;
    const ROLL_TRAVEL = 1.02;
    const FADE_SECONDS = 0.3;
    const EXIT_SECONDS = 0.2;
    const SCROLL_TAU = 0.06;
    const LETTER_SPRING = { damping: 5, stiffness: 100, mass: 1 };
    const NBSP = ' ';

    const toList = (v: unknown) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const settle = (frames: number, tau: number) => (frames <= 0 ? 0 : 1 - Math.exp(-frames / tau));
    const fitScale = (measured: number, budget: number) => (!(measured > 0) || !(budget > 0) ? 1 : Math.min(1, budget / measured));
    const statusAt = (frame: number, intro: number, hold: number, count: number) => {
      let index = 0;
      for (let i = 1; i < count; i += 1) {
        if (frame >= intro + (i - 1) * hold) {
          index = i;
        }
      }
      return { index, since: frame - (intro + (index - 1) * hold) };
    };
    const chipAt = (frame: number, beat: number, stagger: number, count: number) => {
      if (count <= 0 || frame < beat) {
        return { arrived: 0, since: 0 };
      }
      const arrived = Math.min(count, Math.floor((frame - beat) / stagger) + 1);
      return { arrived, since: frame - beat - (arrived - 1) * stagger };
    };

    const { width, height, fps } = view;
    const face = S.pick(p.fontFamily, 'Inter');
    const labels = toList(p.statuses);
    const chipLabels = toList(p.chips);
    const glyphs = [...String(p.prefix)];
    const field = S.pick(p.fieldColor, String(t.primary));
    const page = S.pick(p.pageColor, String(t.background));
    const pillFill = S.pick(p.pillColor, String(t.foreground));
    const prefixInk = S.pick(p.prefixColor, String(t.foreground));
    const labelInk = S.pick(p.pillLabelColor, S.mixOklch(field, String(t.card), 0.62));
    const chipInk = S.pick(p.chipTextColor, String(t.foreground));
    const chipEdge = S.pick(p.chipBorderColor, S.mixOklch(String(t.border), String(t.foreground), 0.28));
    const fills = [String(t.card), S.mixOklch(String(t.card), field, 0.14), field];
    const fontWeight = Number(p.fontWeight);
    const statusHold = Number(p.statusHold);
    const introFrames = Number(p.introFrames);
    const chipStagger = Number(p.chipStagger);
    const speed = Number(p.speed);
    const nominalEm = ACT1_EM * height;
    const nominalChipEm = ACT2_EM * height;
    const typeStyle = { fontFamily: face, fontWeight, fontOpticalSizing: 'none', textRendering: 'geometricPrecision', whiteSpace: 'nowrap' };
    const glyphText = (g: string) => (g === ' ' ? NBSP : g);

    const letterProbes = glyphs.map((g) => S.h('span', { style: { display: 'inline-block' } }, glyphText(g)) as HTMLElement);
    const baselineProbe = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const prefixProbe = S.h('span', { style: { fontSize: nominalEm, lineHeight: 2, ...typeStyle } }, letterProbes, baselineProbe) as HTMLElement;
    const statusProbes = labels.map((s) => S.h('span', { style: { display: 'inline-block', fontSize: nominalEm, ...typeStyle } }, s) as HTMLElement);
    const chipProbes = chipLabels.map((s) => S.h('span', { style: { display: 'inline-block', fontSize: nominalChipEm, ...typeStyle } }, s) as HTMLElement);
    const measuring = S.h('div', { style: { position: 'absolute', visibility: 'hidden', left: 0, top: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } }, prefixProbe, statusProbes, chipProbes);
    const measure = () => ({
      letters: letterProbes.map((el) => ({ left: el.offsetLeft, width: el.offsetWidth })),
      prefixWidth: prefixProbe.offsetWidth,
      baseline: baselineProbe.offsetTop,
      statusWidths: statusProbes.map((el) => el.offsetWidth),
      chipWidths: chipProbes.map((el) => el.offsetWidth)
    });

    const fieldEl = S.fill({ display: 'block', backgroundColor: field }) as HTMLElement;
    const letterEls = glyphs.map((g) => S.h('span', { style: { position: 'absolute', top: 0, ...typeStyle } }, glyphText(g)) as HTMLElement);
    const prefixEl = S.h('div', { style: { position: 'absolute', color: prefixInk, lineHeight: 2, ...typeStyle } }, letterEls) as HTMLElement;
    const labelEl = () => S.h('div', { style: { position: 'absolute', left: '50%', top: 0, display: 'flex', alignItems: 'center', color: labelInk, ...typeStyle } }) as HTMLElement;
    const outgoing = labelEl();
    const incoming = labelEl();
    const pillEl = S.h('div', { style: { position: 'absolute', backgroundColor: pillFill, overflow: 'hidden' } }, outgoing, incoming) as HTMLElement;
    const group = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width, height } }, prefixEl, pillEl) as HTMLElement;
    const chipEls = chipLabels.map((text, i) => S.h('div', { style: { position: 'absolute', top: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: chipInk, ...typeStyle, fontWeight: Number(p.chipFontWeight), backgroundColor: fills[i % fills.length] } }, text) as HTMLElement);
    const chipsEl = S.fill({ display: 'block', overflow: 'hidden' }, chipEls) as HTMLElement;
    view.root.replaceChildren(S.fill({ display: 'block', backgroundColor: page, overflow: 'hidden' }, fieldEl, measuring, group, chipsEl));

    const swapAt = (i: number) => introFrames + (i - 1) * statusHold;
    const act1End = swapAt(labels.length) + statusHold;
    const fadeFrames = FADE_SECONDS * fps;
    const beat = act1End + fadeFrames / 2;

    const renderChips = (frame: number, chipWidths: number[], chipEm: number) => {
      chipsEl.style.display = frame < beat ? 'none' : 'block';
      const chipH = chipEm * (1 + 2 * CHIP_PAD_Y);
      const step = chipH + CHIP_GAP * height;
      const { arrived, since } = chipAt(frame, beat, chipStagger, chipLabels.length);
      const fieldY = height - CHIP_GAP * height - chipH - (arrived - 2 + settle(since, SCROLL_TAU * fps)) * step;
      chipEls.forEach((el, i) => {
        const left = i % 2 === 0;
        el.style.display = i < arrived ? 'flex' : 'none';
        el.style.left = left ? `${CHIP_INSET * width}px` : '';
        el.style.right = left ? '' : `${CHIP_INSET * width}px`;
        el.style.transform = `translateY(${fieldY + i * step}px)`;
        el.style.width = `${chipWidths[i] + 2 * CHIP_PAD_X * chipEm}px`;
        el.style.height = `${chipH}px`;
        el.style.borderRadius = `${CHIP_R * chipH}px`;
        el.style.border = `${CHIP_BORDER * chipH}px solid ${chipEdge}`;
        el.style.fontSize = `${chipEm}px`;
      });
    };

    return (at) => {
      const frame = at * speed;
      const metrics = measure();
      fieldEl.style.opacity = String(1 - S.interpolate(frame, [act1End, act1End + fadeFrames], [0, 1], CLAMP));

      const rawPad = PILL_PAD * PILL_H * nominalEm;
      const rawGap = PILL_GAP * PILL_H * nominalEm;
      const act1Fit = fitScale(metrics.prefixWidth + rawGap + Math.max(0, ...metrics.statusWidths) + 2 * rawPad, ACT1_FIT * width);
      const chipFit = fitScale(Math.max(0, ...metrics.chipWidths) + 2 * CHIP_PAD_X * nominalChipEm, (1 - 2 * CHIP_INSET) * width);
      const em = nominalEm * act1Fit;
      const chipEm = nominalChipEm * chipFit;
      const pillH = PILL_H * em;
      const pillPad = PILL_PAD * pillH;
      const gap = PILL_GAP * pillH;
      const prefixWidth = metrics.prefixWidth * act1Fit;
      const pillWidths = metrics.statusWidths.map((w) => w * act1Fit + 2 * pillPad);
      const { index, since } = statusAt(frame, introFrames, statusHold, labels.length);
      const widthP = index === 0 ? WIDTH_EASE(S.clamp01(frame / introFrames)) : WIDTH_EASE(S.clamp01(since / (WIDTH_SECONDS * fps)));
      const rollP = index === 0 ? 1 : ROLL_EASE(S.clamp01(since / (ROLL_SECONDS * fps)));
      const pillW = S.interpolate(widthP, [0, 1], [index === 0 ? 0 : (pillWidths[index - 1] ?? 0), pillWidths[index] ?? 0]);
      const groupScale = S.spring({ frame, fps, config: { damping: 26, stiffness: 90, mass: 1.4 }, from: 1.16, to: 1 });
      const exitP = settle((frame - beat) * (1 / EXIT_SECONDS / fps), 0.28);
      const exitY = frame < beat ? 0 : -exitP * 0.62 * height;
      const originX = (width - (prefixWidth + gap + pillW)) / 2;
      const cy = PILL_CY * height;

      group.style.display = frame < beat + EXIT_SECONDS * fps ? 'block' : 'none';
      group.style.transform = `translateY(${exitY}px) scale(${groupScale})`;
      group.style.transformOrigin = `${width / 2}px ${cy}px`;

      Object.assign(prefixEl.style, { left: `${originX}px`, top: `${cy - em}px`, height: `${2 * em}px`, fontSize: `${em}px` });
      letterEls.forEach((el, i) => {
        const s = S.interpolate(S.spring({ frame: frame - i, fps, config: LETTER_SPRING }), [0, 1], [0.1, 1]);
        el.style.left = `${(metrics.letters[i]?.left ?? 0) * act1Fit}px`;
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = `50% ${metrics.baseline * act1Fit}px`;
      });

      Object.assign(pillEl.style, { left: `${originX + prefixWidth + gap}px`, top: `${cy - pillH / 2}px`, width: `${pillW}px`, height: `${pillH}px`, borderRadius: `${PILL_R * pillH}px` });
      const travel = ROLL_TRAVEL * pillH;
      const place = (el: HTMLElement, text: string, offset: number, shown: boolean) => {
        el.style.display = shown ? 'flex' : 'none';
        el.textContent = text;
        el.style.height = `${pillH}px`;
        el.style.fontSize = `${em}px`;
        el.style.transform = `translate(-50%, ${offset}px)`;
      };
      place(outgoing, labels[index - 1] ?? '', -rollP * travel, rollP < 1 && index > 0);
      place(incoming, labels[index] ?? '', (1 - rollP) * travel, true);

      renderChips(frame, metrics.chipWidths.map((w) => w * chipFit), chipEm);
    };
  }
};
