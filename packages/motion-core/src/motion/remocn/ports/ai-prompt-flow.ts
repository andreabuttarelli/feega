import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'ai-prompt-flow',
  title: 'AI prompt flow',
  about: 'A prompt is typed, Generate is pressed, a skeleton shimmers while loading and the answer fades in with a toast.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 230,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    prompt: { type: 'string', title: 'Prompt', default: "Summarize this thread", group: 'Content', maxLength: 80 },
    buttonLabel: { type: 'string', title: 'Button', default: "Generate", group: 'Content', maxLength: 30 },
    answerLines: { type: 'string', title: 'Answer (one line per row)', format: PropFormat.Textarea, default: "The thread debates the Q3 roadmap: ship the editor first,\ndefer billing to Q4, and pull the migration forward so\ninfra is unblocked before the team scales next quarter.", group: 'Content' },
    toastTitle: { type: 'string', title: 'Toast', default: "Response ready", group: 'Content', maxLength: 50 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    type V = Record<string, any>;
    type Step = { at: number; state: string; duration?: number };
    const sans = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const T = { bg: '#ffffff', fg: '#0a0a0a', pri: '#171717', priFg: '#fafafa', mut: '#f5f5f5', mutFg: '#737373', bor: '#e5e5e5', ring: '#a1a1a1', green: '#009b44', radius: 10 };
    const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7';
    const CHECK_LEN = 14;
    const JUSTIFY: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };
    const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const easeOut = (k: number) => 1 - (1 - k) ** 3;
    const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    const mix = (a: string, b: string, k: number) => (a === b ? a : S.mixOklch(a, b, k));
    const tween = (a: V, b: V, k: number): V => Object.fromEntries(Object.keys(a).map((key) => [key, typeof a[key] === 'string' ? mix(a[key], b[key], k) : lerp(a[key], b[key], k)]));
    const phase = (steps: Step[], fallback: string, dur: number, f: number) => {
      const started = steps
        .map((step, index) => ({ step, index }))
        .sort((x, y) => x.step.at - y.step.at || x.index - y.index)
        .filter((e) => e.step.at <= f);
      if (started.length === 0) {
        return { from: fallback, to: fallback, k: 1 };
      }
      const to = started[started.length - 1].step;
      const from = started.length >= 2 ? started[started.length - 2].step.state : fallback;
      const d = to.duration ?? dur;
      return { from, to: to.state, k: easeOut(d > 0 ? clamp01((f - to.at) / d) : 1) };
    };
    const anim = (steps: Step[], fallback: string, dur: number, styleOf: (s: string) => V) => (f: number): V => {
      const ph = phase(steps, fallback, dur, f);
      return tween(styleOf(ph.from), styleOf(ph.to), ph.k);
    };
    const el = (tag: string, style: V, ...kids: any[]) => S.h(tag, { style }, ...kids) as HTMLElement;
    const svg = (size: number, ...kids: any[]) => S.h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }, ...kids) as unknown as HTMLElement;
    const tick = (color: string, width: number) => S.h('path', { d: CHECK_PATH, stroke: color, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: CHECK_LEN, strokeDasharray: CHECK_LEN, strokeDashoffset: 0 });
    const centre = (style: V, ...kids: any[]) => el('div', { ...FILL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, ...style }, ...kids);
    const text = (tag: string, style: V, value: string) => el(tag, { fontFamily: sans, ...style }, value);

    const inputStyleOf = (state: string): V => {
      const idle = { border: T.bor, ringColor: mix(T.bg, T.ring, 0.5), ringW: 0, bg: T.bg, caret: 0, reveal: 0, hint: 1 };
      if (state === 'active') {
        return { ...idle, border: T.ring, ringW: 3, caret: 1 };
      }
      if (state === 'typing') {
        return { ...idle, border: T.ring, ringW: 3, caret: 1, reveal: 1, hint: 0 };
      }
      if (state === 'blur') {
        return { ...idle, reveal: 1, hint: 0 };
      }
      return idle;
    };
    const mkInput = (placeholder: string, value: string, wide: boolean) => {
      const hint = el('span', { position: 'absolute', left: 14, color: T.mutFg, whiteSpace: 'nowrap', pointerEvents: 'none' }, placeholder);
      const typed = el('span', { whiteSpace: 'nowrap', color: T.fg });
      const caret = el('span', { display: 'inline-block', flexShrink: 0, width: 2, height: 17, borderRadius: 1, background: T.fg, opacity: 0 });
      const box = el('div', { position: 'relative', display: 'flex', alignItems: 'center', boxSizing: 'border-box', width: wide ? '100%' : 320, height: 40, padding: '0 14px', fontSize: 15, letterSpacing: '-0.01em', borderRadius: T.radius }, hint, el('div', { display: 'flex', alignItems: 'center', minWidth: 0 }, typed, caret));
      return {
        root: centre({}, box),
        set: (v: V) => {
          const shown = value.slice(0, Math.round(value.length * v.reveal));
          typed.textContent = shown;
          caret.style.marginLeft = shown.length > 0 ? '4px' : '0';
          caret.style.opacity = String(v.caret);
          hint.style.opacity = String(v.reveal > 0 ? 0 : v.hint);
          box.style.background = v.bg;
          box.style.border = `1px solid ${v.border}`;
          box.style.boxShadow = `0 0 0 ${v.ringW}px ${v.ringColor}`;
        }
      };
    };

    const buttonStyleOf = (outline: boolean) => {
      const hover = outline ? T.mut : mix(T.pri, T.fg, 0.1);
      const rest = outline ? T.bg : T.pri;
      const press = outline ? hover : mix(hover, T.fg, 0.08);
      return (state: string): V => {
        if (state === 'hover') {
          return { ty: -1, scale: 1, bg: hover, label: 1, spin: 0, done: 0 };
        }
        if (state === 'press') {
          return { ty: -1, scale: 0.97, bg: press, label: 1, spin: 0, done: 0 };
        }
        if (state === 'loading') {
          return { ty: -1, scale: 1, bg: hover, label: 0, spin: 1, done: 0 };
        }
        if (state === 'success') {
          return { ty: -1, scale: 1, bg: T.pri, label: 0, spin: 0, done: 1 };
        }
        return { ty: 0, scale: 1, bg: rest, label: 1, spin: 0, done: 0 };
      };
    };
    const ICON = 17;
    const layer = (kid: any) => el('span', { ...FILL, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }, kid);
    const mkButton = (caption: string, align: string) => {
      const label = el('span', {}, caption);
      const wheel = svg(ICON, S.h('circle', { cx: 12, cy: 12, r: 9, stroke: T.priFg, strokeWidth: 2.5, strokeLinecap: 'round', strokeDasharray: 44, strokeDashoffset: 33 }));
      const wheelLayer = layer(wheel);
      const doneLayer = layer(svg(ICON, tick(T.priFg, 2.6)));
      const face = el('div', { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', height: 40, padding: '0 20px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.priFg, border: '1px solid transparent', borderRadius: T.radius }, el('span', { position: 'relative', display: 'inline-flex' }, label, wheelLayer, doneLayer));
      return {
        root: centre({ justifyContent: JUSTIFY[align] }, face),
        caption: (value: string) => {
          label.textContent = value;
        },
        set: (v: V, f: number) => {
          face.style.transform = `translateY(${v.ty}px) scale(${v.scale})`;
          face.style.background = v.bg;
          label.style.opacity = String(v.label);
          wheelLayer.style.opacity = String(v.spin);
          wheel.style.transform = `rotate(${f * 6}deg)`;
          doneLayer.style.opacity = String(v.done);
        }
      };
    };

    const toastStyleOf = (state: string): V => (state === 'visible' ? { opacity: 1, ty: 0, scale: 1 } : { opacity: 0, ty: 16, scale: 0.97 });
    const mkToast = (title: string, right: number, bottom: number) => {
      const card = el('div', { display: 'flex', alignItems: 'center', gap: 12, width: 356, boxSizing: 'border-box', padding: 16, background: T.bg, color: T.fg, border: `1px solid ${T.bor}`, borderRadius: T.radius, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', transformOrigin: 'bottom center', fontFamily: sans, opacity: 0 }, el('span', { display: 'flex', alignItems: 'center', justifyContent: 'center' }, svg(18, S.h('circle', { cx: 12, cy: 12, r: 9, stroke: T.green, strokeWidth: 2 }), S.h('path', { d: 'M8 12.5l2.6 2.6L16 9', stroke: T.green, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))), el('span', { fontSize: 14, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.01em' }, title));
      return {
        root: el('div', { position: 'absolute', right, bottom }, card),
        set: (v: V) => {
          card.style.opacity = String(v.opacity);
          card.style.transform = `translateY(${v.ty}px) scale(${v.scale})`;
        }
      };
    };

    const SWEEP_FRAMES = 60;
    const skeletonStyleOf = (state: string): V => (state === 'loaded' ? { shell: 0, content: 1 } : { shell: 1, content: 0 });
    const shimmer = (width: string, height: number) => el('div', { width, height, borderRadius: 6 });
    const paintShimmer = (node: HTMLElement, f: number) => {
      const base = T.mut;
      const glow = mix(base, T.fg, 0.13);
      node.style.background = `linear-gradient(90deg, ${base} 20%, ${glow} 50%, ${base} 80%)`;
      node.style.backgroundSize = '200% 100%';
      node.style.backgroundPosition = `${100 - ((f % SWEEP_FRAMES) / SWEEP_FRAMES) * 200}% 0`;
    };

    const PROMPT_LEFT = (1280 - 520) / 2;
    const PROMPT_TOP = 168;
    const PROMPT_W = 520;
    const PROMPT_H = 92;
    const BTN_W = 200;
    const BTN_LEFT = (1280 - BTN_W) / 2;
    const BTN_TOP = 278;
    const BTN_H = 64;
    const ANSWER_W = 560;
    const ANSWER_LEFT = (1280 - ANSWER_W) / 2;
    const ANSWER_TOP = 380;
    const lines = String(p.answerLines).split('\n').filter(Boolean);

    const promptInput = mkInput('Ask anything…', String(p.prompt), false);
    const go = mkButton(String(p.buttonLabel), 'center');
    const toast = mkToast(String(p.toastTitle), 32, 32);
    const inputAt = anim([{ at: 0, state: 'active', duration: 1 }, { at: 0, state: 'typing', duration: 50 }], 'idle', 8, inputStyleOf);
    const goAt = anim([{ at: 52, state: 'hover', duration: 6 }, { at: 58, state: 'press', duration: 4 }, { at: 62, state: 'loading', duration: 4 }], 'idle', 8, buttonStyleOf(false));
    const shellAt = anim([{ at: 64, state: 'loading', duration: 1 }, { at: 150, state: 'loaded', duration: 16 }], 'loading', 12, skeletonStyleOf);
    const toastAt = anim([{ at: 160, state: 'visible', duration: 14 }, { at: 220, state: 'hidden', duration: 14 }], 'hidden', 12, toastStyleOf);

    const bars = lines.map((_, i) => shimmer(i === lines.length - 1 ? '70%' : '100%', 18));
    const placeholder = el('div', { ...FILL, pointerEvents: 'none', opacity: 1 }, el('div', { display: 'flex', flexDirection: 'column', gap: 14, width: ANSWER_W }, bars));
    const answer = el('div', { display: 'flex', flexDirection: 'column', gap: 8, width: ANSWER_W, fontFamily: sans, fontSize: 18, lineHeight: 1.45, letterSpacing: '-0.01em', color: T.fg, opacity: 0 }, lines.map((line) => el('span', {}, line)));
    const answerBox = el('div', { position: 'absolute', left: ANSWER_LEFT, top: ANSWER_TOP, width: ANSWER_W, display: 'flex', justifyContent: 'center', opacity: 0 }, el('div', { position: 'relative', display: 'inline-block', fontFamily: sans }, answer, placeholder));
    const place = (left: number, top: number, width: number, height: number, kid: any) => el('div', { position: 'absolute', left, top, width, height }, kid);
    view.root.replaceChildren(S.fill({}, place(PROMPT_LEFT, PROMPT_TOP, PROMPT_W, PROMPT_H, promptInput.root), place(BTN_LEFT, BTN_TOP, BTN_W, BTN_H, go.root), answerBox, toast.root));

    return (f) => {
      const button = goAt(f);
      const shell = shellAt(f);
      promptInput.set(inputAt(f));
      go.set(button, f);
      answerBox.style.opacity = String(button.spin);
      answer.style.opacity = String(shell.content);
      placeholder.style.opacity = String(shell.shell);
      bars.forEach((bar) => paintShimmer(bar, f));
      toast.set(toastAt(f));
    };
  }
};
