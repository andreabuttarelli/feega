import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'onboarding-stepper-flow',
  title: 'Onboarding stepper flow',
  about: 'A stepper advances through account, plan and settings panels, ending on a Finish button that resolves to a check.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 175,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    steps: { type: 'string', title: 'Steps (comma separated)', default: "Account, Plan, Settings", group: 'Content', maxLength: 120 },
    email: { type: 'string', title: 'Email', default: "jane@acme.com", group: 'Content', maxLength: 60 },
    plans: { type: 'string', title: 'Plans (comma separated)', default: "Free, Pro, Team", group: 'Content', maxLength: 80 },
    nextLabel: { type: 'string', title: 'Next label', default: "Next", group: 'Content', maxLength: 30 },
    finishLabel: { type: 'string', title: 'Finish label', default: "Finish", group: 'Content', maxLength: 30 },
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

    type Move = { at: number; index: number; duration?: number };
    const stepperAt = (moves: Move[], f: number) => {
      const first = moves[0];
      if (f <= first.at) {
        return first.index;
      }
      let toIndex = moves.length - 1;
      for (let i = 1; i < moves.length; i++) {
        if (moves[i].at > f) {
          toIndex = i;
          break;
        }
      }
      const last = moves[moves.length - 1];
      const past = f >= last.at;
      const to = past ? last : moves[toIndex];
      const from = past ? last : moves[toIndex - 1];
      const dur = to.duration ?? 24;
      const k = past || dur <= 0 ? 1 : easeOut(clamp01((f - (to.at - dur)) / dur));
      return from.index + (to.index - from.index) * k;
    };
    const mkStepper = (labels: string[]) => {
      const CIRCLE = 36;
      const circles = labels.map((_, i) => {
        const num = el('span', { position: 'absolute', fontSize: 14, fontWeight: 600 }, String(i + 1));
        const mark = tick(T.priFg, 2.6);
        const disc = el('div', { position: 'relative', width: CIRCLE, height: CIRCLE, borderRadius: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }, num, svg(CIRCLE, mark));
        const name = text('span', { fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }, labels[i]);
        const bar = el('div', { position: 'absolute', left: 0, top: 0, bottom: 0, background: T.pri });
        const link = i === labels.length - 1 ? null : el('div', { position: 'relative', width: 64, height: 2, marginTop: CIRCLE / 2 - 1, background: T.bor, overflow: 'hidden' }, bar);
        const column = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: CIRCLE + 24 }, disc, name);
        return { cell: el('div', { display: 'flex', alignItems: 'flex-start' }, column, link), num, mark, disc, name, bar };
      });
      return {
        root: centre({}, el('div', { display: 'flex', alignItems: 'flex-start' }, circles.map((c) => c.cell))),
        set: (position: number) => {
          circles.forEach((c, i) => {
            const fill = clamp01(position - i);
            const active = Math.floor(position) === i && fill < 1;
            const lit = active || fill >= 1;
            c.disc.style.background = mix(T.mut, T.pri, fill);
            c.disc.style.border = `2px solid ${active ? T.pri : mix(T.bor, T.pri, fill)}`;
            c.num.style.opacity = String(1 - fill);
            c.num.style.color = lit ? T.fg : T.mutFg;
            c.mark.setAttribute('stroke-dashoffset', String(CHECK_LEN * (1 - fill)));
            c.name.style.color = lit ? T.fg : T.mutFg;
            c.bar.style.width = `${fill * 100}%`;
          });
        }
      };
    };

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

    const radioStyleOf = (state: string): V => (state === 'checked' ? { border: T.pri, dot: 1, scale: 1 } : { border: T.bor, dot: 0, scale: 0.4 });
    const mkRadio = (caption: string) => {
      const dot = el('span', { width: 9, height: 9, borderRadius: '50%', background: T.pri, opacity: 0 });
      const ring = el('span', { display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: 20, height: 20, borderRadius: '50%', background: T.bg }, dot);
      return {
        root: centre({}, el('span', { display: 'inline-flex', alignItems: 'center', gap: 10 }, ring, text('span', { fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.fg }, caption))),
        set: (v: V) => {
          ring.style.border = `1px solid ${v.border}`;
          dot.style.opacity = String(v.dot);
          dot.style.transform = `scale(${v.scale})`;
        }
      };
    };

    const switchStyleOf = (state: string): V => (state === 'checked' ? { track: T.pri, thumb: 1 } : { track: T.bor, thumb: 0 });
    const mkSwitch = (caption: string) => {
      const TRACK_W = 44;
      const TRACK_H = 24;
      const THUMB = 20;
      const PAD = 2;
      const travel = TRACK_W - THUMB - PAD * 2;
      const thumb = el('span', { position: 'absolute', left: PAD, width: THUMB, height: THUMB, borderRadius: '50%', background: T.bg, boxShadow: '0 1px 2px rgba(0,0,0,0.15)' });
      const track = el('span', { position: 'relative', display: 'flex', alignItems: 'center', width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2 }, thumb);
      const label = caption ? text('span', { fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.fg }, caption) : null;
      return {
        root: centre({}, el('span', { display: 'inline-flex', alignItems: 'center', gap: 10 }, track, label)),
        set: (v: V) => {
          track.style.background = v.track;
          thumb.style.transform = `translateX(${v.thumb * travel}px)`;
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

    const list = (value: unknown) => String(value).split(',').map((s) => s.trim()).filter(Boolean);
    const labels = list(p.steps);
    const plans = list(p.plans);
    const STEPPER_TOP = 96;
    const STEPPER_HEIGHT = 100;
    const CONTENT_TOP = 300;
    const CONTENT_HEIGHT = 220;
    const NAV_TOP = 540;
    const NAV_HEIGHT = 64;
    const MOVES = [{ at: 0, index: 0 }, { at: 64, index: 1, duration: 20 }, { at: 104, index: 2, duration: 20 }];
    const email = String(p.email);

    const stepper = mkStepper(labels);
    const nameInput = mkInput(email, email, false);
    const plan = mkRadio(plans[1] ?? 'Pro');
    const alerts = mkSwitch('Email notifications');
    const nav = mkButton(String(p.nextLabel), 'center');

    const nameAt = anim([{ at: 2, state: 'active', duration: 8 }, { at: 10, state: 'typing', duration: 45 }], 'idle', 8, inputStyleOf);
    const planAt = anim([{ at: 90, state: 'checked', duration: 14 }], 'unchecked', 10, radioStyleOf);
    const alertsAt = anim([{ at: 130, state: 'checked', duration: 14 }], 'unchecked', 10, switchStyleOf);
    const navAt = anim([{ at: 60, state: 'press', duration: 6 }, { at: 64, state: 'idle', duration: 6 }, { at: 100, state: 'press', duration: 6 }, { at: 104, state: 'idle', duration: 6 }, { at: 150, state: 'press', duration: 6 }, { at: 156, state: 'success', duration: 14 }], 'idle', 8, buttonStyleOf(false));

    const slot = (top: number, height: number, ...kids: any[]) => el('div', { position: 'absolute', left: 0, right: 0, top, height }, ...kids);
    const panels = [nameInput, plan, alerts].map((part) => el('div', { ...FILL }, part.root));
    view.root.replaceChildren(S.fill({ fontFamily: sans }, slot(STEPPER_TOP, STEPPER_HEIGHT, stepper.root), slot(CONTENT_TOP, CONTENT_HEIGHT, panels), slot(NAV_TOP, NAV_HEIGHT, nav.root)));

    return (f) => {
      const position = stepperAt(MOVES, f);
      stepper.set(position);
      nameInput.set(nameAt(f));
      plan.set(planAt(f));
      alerts.set(alertsAt(f));
      panels.forEach((panel, i) => {
        panel.style.opacity = String(clamp01(1 - Math.abs(position - i)));
      });
      nav.caption(position >= labels.length - 1 ? String(p.finishLabel) : String(p.nextLabel));
      nav.set(navAt(f), f);
    };
  }
};
