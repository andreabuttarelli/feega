import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'search-typing',
  title: 'Search typing',
  about: 'A search field wider than the shot comes forward, types a sentence, pans across to its right half, then pulls back to show the whole field.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 60,
  frames: 420,
  background: '#faf9f6',
  fonts: ['Outfit'],
  props: {
    text: { type: 'string', title: 'Text', default: 'How do I make my product demo actually look expensive?', group: 'Content', maxLength: 200 },
    icon: { type: 'string', title: 'Icon', enum: ['search', 'sparkle', 'none'], default: 'search', group: 'Content' },
    surface: { type: 'string', title: 'Surface', enum: ['shadcn', 'glass'], default: 'shadcn', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Outfit', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 300, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    caret: { type: 'boolean', title: 'Caret', default: true, group: 'Style' },
    charsPerSecond: { type: 'number', title: 'Characters per second', default: 14, minimum: 1, maximum: 60, step: 0.5, group: 'Motion' },
    humanize: { type: 'number', title: 'Keystroke variance', default: 0.35, minimum: 0, maximum: 1, step: 0.05, group: 'Motion' },
    wordPause: { type: 'number', title: 'Pause after space (x)', default: 1.55, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    punctuationPause: { type: 'number', title: 'Pause after punctuation (x)', default: 2.2, minimum: 0, maximum: 6, step: 0.05, group: 'Motion' },
    startDelay: { type: 'number', title: 'Start delay (s)', default: 0.5, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    dollyDuration: { type: 'number', title: 'Dolly (s)', default: 0.8, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    panDuration: { type: 'number', title: 'Pan (s)', default: 0.5, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    holdAfter: { type: 'number', title: 'Hold after typing (s)', default: 0.9, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    recedeDuration: { type: 'number', title: 'Recede (s)', default: 1.2, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    dolly: { type: 'number', title: 'Dolly scale', default: 1.25, minimum: 1, maximum: 3, step: 0.01, group: 'Motion' },
    fieldHeight: { type: 'number', title: 'Field height (frame fraction)', default: 0.27, minimum: 0.05, maximum: 0.9, step: 0.01, group: 'Layout' },
    frontVisible: { type: 'number', title: 'Visible part at front', default: 0.56, minimum: 0.05, maximum: 1, step: 0.01, group: 'Layout' },
    edgeInset: { type: 'number', title: 'Edge inset (px)', default: 40, minimum: 0, maximum: 300, step: 1, group: 'Layout' },
    caretBlinksPerSecond: { type: 'number', title: 'Caret blinks per second', default: 1, minimum: 0, maximum: 5, step: 0.1, group: 'Motion' },
    seed: { type: 'string', title: 'Seed', default: 'search-typing', group: 'Motion', maxLength: 60 },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const text = String(p.text);
    const fps = view.fps;
    const frameWidth = view.width;
    const frameHeight = view.height;
    const num = (k: string) => Number(p[k]);
    const surface = String(p.surface);
    const icon = String(p.icon);
    const R = { radius: 0.276, fontSize: 0.379, textInk: 1.024, sideBearing: 0.021, iconInset: 0.357, iconSize: 0.378, rightPad: 0.4, caretWidth: 0.024, caretHeight: 0.434, baselineNudge: 0.017 };
    const H = 240;
    const textLeft = (R.textInk - R.sideBearing) * H;
    const gap = (R.textInk - R.sideBearing - R.iconInset - R.iconSize) * H;
    const fontSize = R.fontSize * H;
    const caretWidth = Math.max(1, R.caretWidth * H);
    const caretHeight = R.caretHeight * H;
    const iconSize = R.iconSize * H;
    const lineHeight = Math.round(fontSize * 1.4);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const DOLLY = S.Easing.inOut(S.Easing.sin);
    const PAN = S.Easing.inOut(S.Easing.cubic);
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const smooth = (x: number) => { const y = clamp01(x); return y * y * (3 - 2 * y); };

    const base = fps / Math.max(0.1, num('charsPerSecond'));
    const jitter = clamp01(num('humanize'));
    const schedule = [0];
    let acc = 0;
    for (let i = 0; i < text.length; i++) {
      const prev = i > 0 ? text[i - 1] : '';
      let interval = base;
      if (prev === ' ') {
        interval *= num('wordPause');
      } else if (prev !== '' && /[.,!?;:]/.test(prev)) {
        interval *= num('punctuationPause');
      }
      if (jitter > 0) {
        interval *= 1 + (S.random(`${String(p.seed)}-key-${i}`) * 2 - 1) * 0.35 * jitter;
      }
      acc += Math.max(0.001, interval);
      schedule.push(acc);
    }
    const typedCount = (f: number) => {
      if (f <= 0 || schedule.length <= 1) {
        return 0;
      }
      let n = 0;
      while (n + 1 < schedule.length && schedule[n + 1] <= f) {
        n++;
      }
      return n;
    };

    const borderColor = S.mixOklch(String(t.input), String(t.foreground), 0.28);
    const glass = surface === 'glass';
    const ink = glass ? '#000000' : String(t.foreground);
    const iconColor = glass ? '#000000' : String(t.mutedForeground);
    const svg = (...kids: Node[]) => S.h('svg', { width: iconSize, height: iconSize, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0, overflow: 'visible' } }, ...kids);
    const glyphs: Record<string, () => Node> = {
      search: () => svg(S.h('circle', { cx: 9, cy: 9, r: 7.98, stroke: iconColor, 'stroke-width': 2.03 }), S.h('path', { d: 'M14.65 14.65 L22.98 22.98', stroke: iconColor, 'stroke-width': 2.03, 'stroke-linecap': 'round' })),
      sparkle: () => svg(S.h('path', { d: 'M12 2.6 L13.9 9.1 L20.4 11 L13.9 12.9 L12 19.4 L10.1 12.9 L3.6 11 L10.1 9.1 Z', fill: iconColor }), S.h('path', { d: 'M18.9 16.4 L19.7 19.1 L22.4 19.9 L19.7 20.7 L18.9 23.4 L18.1 20.7 L15.4 19.9 L18.1 19.1 Z', fill: iconColor, opacity: 0.55 }))
    };

    const baseline = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const run = document.createTextNode(text);
    const textEl = S.h('span', { style: { fontSize, fontWeight: num('fontWeight'), fontFamily: S.pick(p.fontFamily, 'Outfit'), lineHeight: `${lineHeight}px`, color: ink, whiteSpace: 'pre', fontVariantLigatures: 'none', fontKerning: 'normal', textRendering: 'geometricPrecision', display: 'block' } }, run, baseline) as HTMLElement;
    const caretEl = S.h('span', { style: { display: p.caret === false ? 'none' : 'inline-block', flexShrink: 0, width: caretWidth, height: caretHeight, borderRadius: 0, background: ink, position: 'absolute', top: (lineHeight - caretHeight) / 2 } }) as HTMLElement;
    const line = S.h('div', { style: { position: 'relative', height: lineHeight, flexShrink: 0, marginTop: -2 * R.baselineNudge * H } }, textEl, caretEl);
    const border = Math.max(1, 0.009 * H);
    const field = S.h('div', { style: { display: 'flex', alignItems: 'center', width: 'max-content', height: H, paddingLeft: R.iconInset * H, paddingRight: R.rightPad * H, gap: gap, borderRadius: R.radius * H, background: glass ? 'linear-gradient(180deg, #C4C4C4 0%, #D6D6D6 15%, #E7E7E7 30%, #F3F3F3 40%, #FDFDFD 50%, #FDFDFD 100%)' : String(t.card), border: glass ? 'none' : `${border}px solid ${borderColor}`, boxShadow: glass ? `0 ${0.045 * H}px ${0.12 * H}px rgba(9, 9, 12, 0.45)` : 'none', boxSizing: 'border-box' } }, glyphs[icon] ? glyphs[icon]() : null, line) as HTMLElement;
    const camera = S.h('div', { style: { position: 'absolute', left: 0, top: (frameHeight - H) / 2 } }, field) as HTMLElement;
    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden' } }, camera));

    let metrics: { advances: number[]; baselineY: number; fieldWidth: number } | null = null;
    let measuredFont = '';
    const measure = () => {
      const fontKey = `${document.fonts ? document.fonts.status : ''}`;
      if (metrics && measuredFont === fontKey) {
        return metrics;
      }
      const previous = camera.style.transform;
      camera.style.transform = 'none';
      field.style.width = 'max-content';
      const fieldRect = field.getBoundingClientRect();
      const range = document.createRange();
      const advances = [0];
      for (let i = 1; i <= text.length; i++) {
        range.setStart(run, 0);
        range.setEnd(run, i);
        advances.push(range.getBoundingClientRect().width);
      }
      metrics = { advances, baselineY: baseline.getBoundingClientRect().top - fieldRect.top, fieldWidth: fieldRect.width };
      measuredFont = fontKey;
      camera.style.transform = previous;
      return metrics;
    };

    const caretOpacity = (f: number) => {
      const bps = num('caretBlinksPerSecond');
      if (bps <= 0 || fps <= 0) {
        return 1;
      }
      const period = fps / bps;
      const x = (((f % period) + period) % period) / period;
      const edge = 0.12;
      if (x < 0.5 - edge) {
        return 1;
      }
      if (x < 0.5) {
        return 1 - smooth((x - (0.5 - edge)) / edge);
      }
      if (x < 1 - edge) {
        return 0;
      }
      return smooth((x - (1 - edge)) / edge);
    };

    return (at) => {
      const m = measure();
      const clock = at * num('speed');
      const edgeInset = num('edgeInset');
      const typingStart = num('startDelay') * fps;
      const typingEnd = typingStart + schedule[schedule.length - 1];
      const count = typedCount(clock - typingStart);
      const pageWidth = frameWidth - edgeInset * 2;
      const frontScale = (num('fieldHeight') * frameHeight) / H;
      const restScale = frontScale / Math.max(1.0001, num('dolly'));
      const fieldWidth = Math.max(m.fieldWidth, pageWidth / Math.max(0.05, Math.min(1, num('frontVisible'))) / frontScale);
      let trigger: number | null = null;
      for (let n = 1; n < m.advances.length; n++) {
        if ((textLeft + m.advances[n]) * frontScale > pageWidth * 0.88) {
          trigger = n;
          break;
        }
      }
      const dollyEnd = typingStart + num('dollyDuration') * fps;
      const holdEnd = typingEnd + num('holdAfter') * fps;
      const recedeEnd = holdEnd + num('recedeDuration') * fps;
      const push = dollyEnd <= typingStart ? (clock >= typingStart ? 1 : 0) : S.interpolate(clock, [typingStart, dollyEnd], [0, 1], { ...clamped, easing: DOLLY });
      const back = recedeEnd <= holdEnd ? 0 : S.interpolate(clock, [holdEnd, recedeEnd], [0, 1], { ...clamped, easing: PAN });
      const panStart = trigger === null ? 0 : typingStart + schedule[trigger];
      const panEnd = panStart + num('panDuration') * fps;
      const pan = trigger === null || panEnd <= panStart ? 0 : S.interpolate(clock, [panStart, panEnd], [0, 1], { ...clamped, easing: PAN });
      const endScale = pageWidth / Math.max(1, fieldWidth);
      const forward = restScale + (frontScale - restScale) * push;
      const scale = forward + (endScale - forward) * back;
      const originX = edgeInset + (frameWidth - edgeInset - fieldWidth * scale - edgeInset) * pan;
      const contentWidth = m.advances[m.advances.length - 1];
      const caretX = m.advances[Math.min(count, m.advances.length - 1)];

      field.style.width = `${fieldWidth}px`;
      camera.style.transformOrigin = `0px ${m.baselineY}px`;
      camera.style.transform = `translateX(${originX}px) scale(${scale})`;
      textEl.style.clipPath = `inset(-0.5em ${Math.max(0, contentWidth - caretX)}px -0.5em 0)`;
      caretEl.style.left = `${caretX}px`;
      caretEl.style.opacity = String(caretOpacity(clock));
    };
  }
};
