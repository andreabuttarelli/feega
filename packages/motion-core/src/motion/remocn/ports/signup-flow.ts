import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'signup-flow',
  title: 'Signup flow',
  about: 'A cursor fills a sign-up form field by field, submits it with a loading button and finishes on a success toast.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 380,
  background: '#f5f5f5',
  fonts: ['Geist'],
  props: {
    title: { type: 'string', title: 'Title', default: "Create an account", group: 'Content', maxLength: 60 },
    description: { type: 'string', title: 'Description', default: "Enter your information below to create your account", group: 'Content', maxLength: 120 },
    fullName: { type: 'string', title: 'Full name', default: "John Doe", group: 'Content', maxLength: 40 },
    email: { type: 'string', title: 'Email', default: "m@example.com", group: 'Content', maxLength: 60 },
    password: { type: 'string', title: 'Password', default: "••••••••", group: 'Content', maxLength: 30 },
    createLabel: { type: 'string', title: 'Button', default: "Create account", group: 'Content', maxLength: 30 },
    toastTitle: { type: 'string', title: 'Toast', default: "Account created", group: 'Content', maxLength: 50 },
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

    const REVEAL_FRAMES = 16;
    const blurStyleOf = (distance: number) => (state: string): V => (state === 'revealed' ? { blur: 0, opacity: 1, x: 0, y: 0 } : { blur: 8, opacity: 0, x: 0, y: distance });
    const reveal = (node: HTMLElement, at: number, duration = REVEAL_FRAMES, distance = 12) => {
      const style = anim([{ at, state: 'revealed', duration }], 'hidden', 18, blurStyleOf(distance));
      return (f: number) => {
        const v = style(f);
        node.style.opacity = String(v.opacity);
        node.style.filter = v.blur > 0 ? `blur(${v.blur}px)` : 'none';
        node.style.transform = `translate(${v.x}px, ${v.y}px)`;
      };
    };

    type Way = { at: number; x: number; y: number; duration?: number; click?: boolean; press?: boolean };
    const CLICK_FRAMES = 16;
    const PRESS_FRAMES = 8;
    const cursorAt = (ways: Way[], f: number) => {
      const first = ways[0];
      if (f <= first.at) {
        return { x: first.x, y: first.y, ripple: 0, rippleScale: 0, press: 1 };
      }
      let toIndex = ways.length - 1;
      for (let i = 1; i < ways.length; i++) {
        if (ways[i].at > f) {
          toIndex = i;
          break;
        }
      }
      const last = ways[ways.length - 1];
      const past = f >= last.at;
      const to = past ? last : ways[toIndex];
      const from = past ? last : ways[toIndex - 1];
      const dur = to.duration ?? 24;
      const k = past || dur <= 0 ? 1 : easeInOut(clamp01((f - (to.at - dur)) / dur));
      let clickAt = -Infinity;
      ways.forEach((w) => {
        if (w.click && w.at <= f && w.at > clickAt) {
          clickAt = w.at;
        }
      });
      const since = clickAt === -Infinity ? -1 : f - clickAt;
      const live = since >= 0 && since < CLICK_FRAMES;
      const pr = clamp01(since / CLICK_FRAMES);
      const half = PRESS_FRAMES / 2;
      const dip = since < 0 || since >= PRESS_FRAMES ? 1 : 1 - clamp01(since < half ? since / half : 1 - (since - half) / half);
      return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), ripple: live ? 0.5 * (1 - pr) : 0, rippleScale: live ? 2.5 * easeOut(pr) : 0, press: Math.min(dip, (past ? last : from).press ? 0 : 1) };
    };
    const POINTER = 'M8 2.2 C8 1.3 8.7 0.7 9.5 0.7 C10.3 0.7 11 1.3 11 2.2 L11 9 C11 9 11.3 8.4 12.2 8.4 C13 8.4 13.4 9 13.4 9.6 C13.4 9.6 13.9 9.1 14.7 9.1 C15.5 9.1 15.9 9.7 15.9 10.3 C15.9 10.3 16.4 9.9 17.1 9.9 C17.9 9.9 18.3 10.5 18.3 11.2 L18.3 16.8 C18.3 19.8 16.3 22.3 12.8 22.3 L11.4 22.3 C9 22.3 7.9 21.2 6.6 19.2 L4 15.2 C3.5 14.4 3.7 13.4 4.5 12.9 C5.1 12.5 5.9 12.6 6.4 13.2 L8 15 Z';
    const POINTER_SIZE = 28;
    const mkCursor = (ways: Way[]) => {
      const ripple = el('div', { position: 'absolute', left: -POINTER_SIZE * 0.9, top: -POINTER_SIZE * 0.9, width: POINTER_SIZE * 1.8, height: POINTER_SIZE * 1.8, borderRadius: '50%', border: `2px solid ${T.pri}`, opacity: 0, transformOrigin: 'center' });
      const arrow = S.h('svg', { width: POINTER_SIZE, height: POINTER_SIZE, viewBox: '0 0 24 24', fill: 'none', style: { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))', overflow: 'visible' } }, S.h('path', { d: POINTER, fill: T.fg, stroke: T.bg, strokeWidth: 1.4, strokeLinejoin: 'round' })) as unknown as HTMLElement;
      const root = el('div', { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }, ripple, arrow);
      return {
        root,
        set: (f: number) => {
          const v = cursorAt(ways, f);
          root.style.transform = `translate(${v.x}px, ${v.y}px)`;
          ripple.style.opacity = String(v.ripple);
          ripple.style.transform = `scale(${v.rippleScale})`;
          arrow.style.transform = `scale(${0.9 + 0.1 * v.press})`;
        }
      };
    };

    const fieldLabel = (value: string) => text('div', { fontSize: 13, lineHeight: '18px', fontWeight: 500, letterSpacing: '-0.01em', color: T.fg }, value);
    const fieldHint = (value: string) => text('div', { fontSize: 12, lineHeight: '16px', color: T.mutFg }, value);
    const control = (height: number, kid: any) => el('div', { position: 'relative', height }, kid);
    const field = (...kids: any[]) => el('div', { display: 'flex', flexDirection: 'column', gap: 6 }, ...kids);
    const cardShell = (left: number, top: number, width: number, height: number, pad: number, radius: number, gap: number, ...kids: any[]) => el('div', { position: 'absolute', left, top, width, height, boxSizing: 'border-box', padding: pad, display: 'flex', flexDirection: 'column', gap, background: T.bg, border: `1px solid ${T.bor}`, borderRadius: radius, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.22), 0 2px 8px -3px rgba(0,0,0,0.10)' }, ...kids);
    const heading = (title: string, description: string) => el('div', { display: 'flex', flexDirection: 'column', gap: 4 }, text('div', { fontSize: 22, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: T.fg }, title), text('div', { fontSize: 14, lineHeight: '20px', color: T.mutFg }, description));

    const DEMO = 48;
    const CARD_W = 376;
    const CARD_LEFT = (1280 - CARD_W) / 2;
    const CARD_TOP = 48;
    const CARD_HEIGHT = 580;
    const CENTER_X = 640;
    const NAME_Y = 216;
    const EMAIL_Y = 296;
    const PASS_Y = 398;
    const CONFIRM_Y = 500;
    const CREATE_Y = 564;
    const nameValue = String(p.fullName);
    const emailValue = String(p.email);
    const passValue = String(p.password);

    const inName = mkInput(nameValue, nameValue, false);
    const inEmail = mkInput(emailValue, emailValue, false);
    const inPass = mkInput(passValue, passValue, false);
    const inConfirm = mkInput(passValue, passValue, false);
    const create = mkButton(String(p.createLabel), 'center');
    const toast = mkToast(String(p.toastTitle), 32, 32);
    const pointer = mkCursor([{ at: 0, x: 160, y: 120 }, { at: 18 + DEMO, x: CENTER_X, y: NAME_Y, duration: 18, click: true }, { at: 52 + DEMO, x: CENTER_X, y: EMAIL_Y, duration: 30, click: true }, { at: 96 + DEMO, x: CENTER_X, y: PASS_Y, duration: 40, click: true }, { at: 134 + DEMO, x: CENTER_X, y: CONFIRM_Y, duration: 32, click: true }, { at: 176 + DEMO, x: CENTER_X, y: CREATE_Y, duration: 38, click: true }]);

    const typing = (start: number, length: number, end: number) => anim([{ at: start, state: 'active', duration: 6 }, { at: start + 2, state: 'typing', duration: length }, { at: end, state: 'blur', duration: 8 }], 'idle', 8, inputStyleOf);
    const nameAt = typing(18 + DEMO, 20, 52 + DEMO);
    const emailAt = typing(52 + DEMO, 28, 96 + DEMO);
    const passAt = typing(96 + DEMO, 22, 134 + DEMO);
    const confirmAt = typing(134 + DEMO, 22, 176 + DEMO);
    const createAt = anim([{ at: 176 + DEMO, state: 'hover', duration: 8 }, { at: 186 + DEMO, state: 'press', duration: 6 }, { at: 192 + DEMO, state: 'loading', duration: 6 }, { at: 234 + DEMO, state: 'success', duration: 16 }], 'idle', 8, buttonStyleOf(false));
    const toastAt = anim([{ at: 234 + DEMO, state: 'visible', duration: 14 }, { at: 300 + DEMO, state: 'hidden', duration: 14 }], 'hidden', 12, toastStyleOf);

    const block = (kid: any) => el('div', { display: 'block' }, kid);
    const blocks = [
      block(heading(String(p.title), String(p.description))),
      block(field(fieldLabel('Full Name'), control(40, inName.root))),
      block(field(fieldLabel('Email'), control(40, inEmail.root), fieldHint("We'll use this to contact you."))),
      block(field(fieldLabel('Password'), control(40, inPass.root), fieldHint('Must be at least 8 characters long.'))),
      block(field(fieldLabel('Confirm Password'), control(40, inConfirm.root))),
      block(el('div', { display: 'flex', flexDirection: 'column', gap: 10 }, control(40, create.root)))
    ];
    const card = cardShell(CARD_LEFT, CARD_TOP, CARD_W, CARD_HEIGHT, 28, 14, 24, blocks[0], el('div', { display: 'flex', flexDirection: 'column', gap: 16 }, blocks.slice(1, 5)), blocks[5]);
    const reveals = [reveal(card, 0, 18, 0), reveal(blocks[0], 18), reveal(blocks[1], 24), reveal(blocks[2], 30), reveal(blocks[3], 36), reveal(blocks[4], 42), reveal(blocks[5], 48)];
    view.root.replaceChildren(S.fill({ fontFamily: sans }, card, toast.root, pointer.root));

    return (f) => {
      reveals.forEach((apply) => apply(f));
      inName.set(nameAt(f));
      inEmail.set(emailAt(f));
      inPass.set(passAt(f));
      inConfirm.set(confirmAt(f));
      create.set(createAt(f), f);
      toast.set(toastAt(f));
      pointer.set(f);
    };
  }
};
