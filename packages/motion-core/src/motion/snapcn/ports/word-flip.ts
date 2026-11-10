import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'word-flip',
  title: 'Word flip',
  about: 'A line types itself in, then the gradient word in the middle flips through a list of alternatives in a fixed slot.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: [],
  props: {
    prefix: { type: 'string', title: 'Prefix', default: 'Looking For A', group: 'Content', maxLength: 80 },
    words: { type: 'string', title: 'Words (comma separated)', default: 'Modern, Stunning, Minimal', group: 'Content', maxLength: 300 },
    suffix: { type: 'string', title: 'Suffix', default: 'Portfolio', group: 'Content', maxLength: 80 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    gradientFrom: { type: 'string', title: 'Gradient start (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    gradientTo: { type: 'string', title: 'Gradient end (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    caret: { type: 'boolean', title: 'Show caret', default: true, group: 'Style' },
    cps: { type: 'number', title: 'Typing (chars/s)', default: 9, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    typeStart: { type: 'number', title: 'Typing start (frames)', default: 4, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    charFade: { type: 'number', title: 'Char fade (frames)', default: 6, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    jitter: { type: 'number', title: 'Keystroke jitter', default: 0.18, minimum: 0, maximum: 1, step: 0.01, group: 'Motion' },
    pause: { type: 'number', title: 'Pause before flips (frames)', default: 6, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    cycle: { type: 'number', title: 'Frames per word', default: 35, minimum: 4, maximum: 240, step: 1, group: 'Motion' },
    exitDuration: { type: 'number', title: 'Exit (frames)', default: 9, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    enterDuration: { type: 'number', title: 'Enter (frames)', default: 9, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    overlap: { type: 'number', title: 'Overlap (frames)', default: 3, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    repeat: { type: 'boolean', title: 'Loop words', default: true, group: 'Motion' },
    perspective: { type: 'number', title: 'Perspective (em)', default: 6.5, minimum: 0.5, maximum: 50, step: 0.5, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const fps = view.fps;
    const num = (k: string) => Number(p[k]);
    const prefix = String(p.prefix);
    const suffix = String(p.suffix);
    const words = String(p.words).split(',').map((w) => w.trim()).filter(Boolean);
    const em = num('fontSize');
    const cps = num('cps');
    const typeStart = num('typeStart');
    const charFade = num('charFade');
    const jitter = num('jitter');
    const pause = num('pause');
    const cycle = num('cycle');
    const exitDuration = num('exitDuration');
    const enterDuration = num('enterDuration');
    const speed = num('speed');
    const loop = p.repeat !== false;
    const face = S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif');
    const fill = S.pick(p.color, String(t.foreground));
    const from = S.pick(p.gradientFrom, String(t.primary));
    const to = S.pick(p.gradientTo, S.mixOklch(String(t.primary), String(t.destructive), 0.45));
    const M = { exitY: -1.29, enterY: 0.135, rotate: 90, scale: 0.98, blur: 0.085 };
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const ENTER_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);

    const per = fps / Math.max(0.001, cps);
    const offset = (i: number) => (jitter <= 0 ? 0 : (Math.sin(i * 12.9898) * 0.6 + Math.sin(i * 4.1414) * 0.4) * jitter);
    const charStart = (i: number) => typeStart + i * per + offset(i) * per;
    const chars = [...prefix, ...suffix];
    const typingEnd = charStart(Math.max(0, chars.length - 1)) + charFade;
    const first = typingEnd + pause;
    const wordAt = (frame: number) => {
      if (frame < first) {
        return { index: 0, local: frame - first };
      }
      const n = Math.floor((frame - first) / cycle);
      const index = loop ? ((n % words.length) + words.length) % words.length : Math.min(n, words.length - 1);
      return { index, local: frame - first - n * cycle };
    };
    const S_BACK = 1.70158;
    const easeInBack = (x: number) => x * x * ((S_BACK + 1) * x - S_BACK);
    const easeInBackSpeed = (x: number) => Math.abs(3 * (S_BACK + 1) * x * x - 2 * S_BACK * x) / (3 * (S_BACK + 1) - 2 * S_BACK);
    const enterStart = Math.max(0, exitDuration - num('overlap'));
    const exitAt = (lf: number) => {
      const k = S.interpolate(lf, [0, exitDuration], [0, 1], clamped);
      const e = easeInBack(k);
      return { y: e * M.exitY * em, rotate: e * M.rotate, scale: 1 + e * (M.scale - 1), blur: easeInBackSpeed(k) * M.blur * em, opacity: S.interpolate(k, [0.65, 1], [1, 0], clamped) };
    };
    const enterAt = (lf: number) => {
      const e = S.interpolate(lf, [enterStart, enterStart + enterDuration], [0, 1], { ...clamped, easing: ENTER_EASE });
      return { y: (1 - e) * M.enterY * em, rotate: -(1 - e) * M.rotate, scale: M.scale + e * (1 - M.scale), blur: (1 - e) * M.blur * em, opacity: S.interpolate(e, [0, 0.45], [0, 1], clamped) };
    };
    const stateFor = (i: number, entering: number, local: number) => {
      if (i === entering && local >= enterStart) {
        return enterAt(local);
      }
      if (i === entering - 1 && local >= 0 && local <= exitDuration) {
        return exitAt(local);
      }
      if (i === entering && local > exitDuration) {
        return enterAt(local);
      }
      if (i === entering && local < 0) {
        return { y: 0, rotate: 0, scale: 1, blur: 0, opacity: 0 };
      }
      return null;
    };

    const lineStyle = { fontSize: em, fontWeight: num('fontWeight'), color: fill, letterSpacing: '-0.02em', fontFamily: face, lineHeight: 1.25, whiteSpace: 'pre', textRendering: 'geometricPrecision' };
    const typed = chars.map((ch) => S.h('span', null, ch) as HTMLElement);
    const caretBar = S.h('span', { style: { position: 'absolute', left: 0.06 * em, bottom: 0, width: Math.max(2, 0.055 * em), height: 0.78 * em, background: fill, borderRadius: 1 } }) as HTMLElement;
    const caretEl = S.h('span', { style: { position: 'relative', display: 'inline-block', width: 0, verticalAlign: 'baseline' } }, caretBar) as HTMLElement;
    const flips = words.map((w) => S.h('span', { style: { backgroundImage: `linear-gradient(90deg, ${from}, ${to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', position: 'absolute', left: 0, top: 0, display: 'inline-block', width: 'max-content' } }, w) as HTMLElement);
    const slot = S.h('span', { style: { display: 'inline-block', position: 'relative', perspective: `${num('perspective') * em}px`, verticalAlign: 'baseline' } }, S.h('span', { style: { visibility: 'hidden' } }, words[0] ?? ''), flips) as HTMLElement;
    const probes = words.map((w) => S.h('span', { style: { display: 'inline-block' } }, w) as HTMLElement);
    const ruler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    if (probes[0]) {
      probes[0].appendChild(ruler);
    }
    const measurer = S.h('span', { style: { ...lineStyle, position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: 0, top: 0 } }, probes);
    const prefixNodes = typed.slice(0, prefix.length);
    const suffixNodes = typed.slice(prefix.length);
    const line = S.h('span', { style: lineStyle }, prefixNodes, ' ', slot, ' ', suffixNodes) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, measurer, line));

    return (at) => {
      const frame = at * speed;
      const widths = probes.map((el) => el.offsetWidth);
      const max = Math.max(...widths, 1);
      slot.style.width = `${Math.max(...widths, 0)}px`;
      const baseline = ruler.offsetTop;

      typed.forEach((el, i) => {
        const s = charStart(i);
        el.style.opacity = String(S.interpolate(frame, [s, s + charFade], [0, 1], clamped));
      });

      const caretIndex = Math.max(0, Math.min(chars.length, Math.floor((frame - typeStart) / per) + 1));
      const showCaret = p.caret !== false && !(frame > typingEnd + pause) && frame >= typeStart;
      caretBar.style.opacity = String(Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.15);
      caretEl.remove();
      if (showCaret && caretIndex <= prefix.length) {
        line.insertBefore(caretEl, slot.previousSibling);
      } else if (showCaret) {
        line.appendChild(caretEl);
      }

      const { index, local } = wordAt(frame);
      flips.forEach((el, i) => {
        const s = stateFor(i, index, local);
        if (!s || s.opacity <= 0) {
          el.style.display = 'none';
          return;
        }
        const scale = widths[i] > 0 ? max / widths[i] : 1;
        el.style.display = 'inline-block';
        el.style.transformOrigin = `0px ${baseline}px`;
        el.style.transform = `translateY(${s.y}px) rotateX(${s.rotate}deg) scale(${scale * s.scale})`;
        el.style.opacity = String(s.opacity);
        el.style.filter = s.blur > 0.01 ? `blur(${s.blur}px)` : '';
      });
    };
  }
};
