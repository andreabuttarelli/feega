import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'checkout-flow',
  title: 'Checkout flow',
  about: 'A cursor picks a yearly plan, types a card number, accepts the terms and pays, ending on a success toast.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 320,
  background: '#f5f5f5',
  fonts: ['Geist'],
  props: {
    title: { type: 'string', title: 'Title', default: "Upgrade your plan", group: 'Content', maxLength: 60 },
    description: { type: 'string', title: 'Description', default: "Complete your purchase to unlock every feature.", group: 'Content', maxLength: 120 },
    plans: { type: 'string', title: 'Plans (comma separated)', default: "Monthly, Yearly", group: 'Content', maxLength: 40 },
    cardLabel: { type: 'string', title: 'Card label', default: "Card number", group: 'Content', maxLength: 30 },
    cardPlaceholder: { type: 'string', title: 'Card number', default: "4242 4242 4242 4242", group: 'Content', maxLength: 30 },
    termsLabel: { type: 'string', title: 'Terms', default: "I accept the terms and conditions", group: 'Content', maxLength: 60 },
    payLabel: { type: 'string', title: 'Pay button', default: "Pay $49", group: 'Content', maxLength: 30 },
    toastTitle: { type: 'string', title: 'Toast', default: "Payment successful", group: 'Content', maxLength: 50 },
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

    const checkboxStyleOf = (state: string): V => (state === 'checked' ? { bg: T.pri, border: T.pri, opacity: 1, scale: 1, draw: 1 } : { bg: T.bg, border: T.bor, opacity: 0, scale: 0.6, draw: 0 });
    const mkCheckbox = (caption: string, align: string) => {
      const BOX = 20;
      const mark = tick(T.priFg, 2.6);
      const markSvg = svg(BOX, mark);
      const box = el('span', { display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: BOX, height: BOX, borderRadius: Math.round(BOX * 0.28) }, markSvg);
      return {
        root: centre({ justifyContent: JUSTIFY[align] }, el('span', { display: 'inline-flex', alignItems: 'center', gap: 10 }, box, text('span', { fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.fg }, caption))),
        set: (v: V) => {
          box.style.background = v.bg;
          box.style.border = `1px solid ${v.border}`;
          markSvg.style.opacity = String(v.opacity);
          markSvg.style.transform = `scale(${v.scale})`;
          mark.setAttribute('stroke-dashoffset', String(CHECK_LEN * (1 - v.draw)));
        }
      };
    };

    const mkToggle = (labels: string[]) => {
      const SEG = 88;
      const PAD = 4;
      const HEIGHT = 36;
      const thumb = el('div', { position: 'absolute', top: PAD, width: SEG, height: HEIGHT - PAD * 2, background: T.bg, borderRadius: Math.max(2, T.radius - 3), boxShadow: '0 1px 2px rgba(0,0,0,0.1)' });
      const names = labels.map((label) => text('span', { position: 'relative', width: SEG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }, label));
      const track = el('div', { position: 'relative', display: 'flex', height: HEIGHT, padding: PAD, boxSizing: 'border-box', background: T.mut, borderRadius: T.radius }, thumb, names);
      return {
        root: centre({ justifyContent: 'flex-start' }, track),
        set: (offset: number) => {
          thumb.style.left = `${PAD + offset * SEG}px`;
          names.forEach((name, i) => {
            name.style.color = mix(T.mutFg, T.fg, Math.max(0, 1 - Math.abs(i - offset)));
          });
        }
      };
    };

    const list = (value: unknown) => String(value).split(',').map((s) => s.trim()).filter(Boolean);
    const plans = list(p.plans);
    const CARD_W = 420;
    const CARD_PAD = 28;
    const CARD_LEFT = (1280 - CARD_W) / 2;
    const CARD_TOP = 96;
    const CARD_HEIGHT = 420;
    const CENTER_X = 640;
    const CONTENT_LEFT = CARD_LEFT + CARD_PAD;
    const CONTENT_RIGHT = CARD_LEFT + CARD_W - CARD_PAD;
    const TOGGLE_Y = 222;
    const YEARLY_X = CONTENT_LEFT + 4 + 88 + 44;
    const CARD_Y = 312;
    const TERMS_X = CONTENT_LEFT + 12;
    const TERMS_Y = 376;
    const PAY_X = CONTENT_RIGHT - 48;
    const PAY_Y = 442;
    const number = String(p.cardPlaceholder);

    const plansToggle = mkToggle(plans);
    const cardInput = mkInput(number, number, true);
    const terms = mkCheckbox(String(p.termsLabel), 'start');
    const pay = mkButton(String(p.payLabel), 'end');
    const toast = mkToast(String(p.toastTitle), 32, 32);
    const pointer = mkCursor([{ at: 0, x: 140, y: 90 }, { at: 64, x: YEARLY_X, y: TOGGLE_Y, duration: 22, click: true }, { at: 96, x: 640, y: CARD_Y, duration: 24, click: true }, { at: 150, x: TERMS_X, y: TERMS_Y, duration: 30, click: true }, { at: 180, x: PAY_X, y: PAY_Y, duration: 26, click: true }]);

    const toggleAt = anim([{ at: 64, state: '1', duration: 16 }], '0', 14, (s) => ({ offset: Number(s) }));
    const cardAt = anim([{ at: 96, state: 'active', duration: 6 }, { at: 100, state: 'typing', duration: 40 }, { at: 150, state: 'blur', duration: 8 }], 'idle', 8, inputStyleOf);
    const termsAt = anim([{ at: 150, state: 'checked', duration: 14 }], 'unchecked', 10, checkboxStyleOf);
    const payAt = anim([{ at: 172, state: 'hover', duration: 8 }, { at: 180, state: 'press', duration: 6 }, { at: 186, state: 'loading', duration: 6 }, { at: 224, state: 'success', duration: 16 }], 'idle', 8, buttonStyleOf(false));
    const toastAt = anim([{ at: 224, state: 'visible', duration: 14 }, { at: 286, state: 'hidden', duration: 14 }], 'hidden', 12, toastStyleOf);

    const block = (kid: any) => el('div', { display: 'block' }, kid);
    const blocks = [
      block(heading(String(p.title), String(p.description))),
      block(control(44, plansToggle.root)),
      block(field(fieldLabel(String(p.cardLabel)), control(40, cardInput.root))),
      block(control(40, terms.root)),
      block(el('div', { display: 'flex', flexDirection: 'column', gap: 10 }, control(44, pay.root)))
    ];
    const card = cardShell(CARD_LEFT, CARD_TOP, CARD_W, CARD_HEIGHT, CARD_PAD, 14, 24, blocks[0], blocks[1], el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, blocks[2], blocks[3]), blocks[4]);
    const reveals = [reveal(card, 0, 18, 0), reveal(blocks[0], 18), reveal(blocks[1], 24), reveal(blocks[2], 30), reveal(blocks[3], 36), reveal(blocks[4], 42)];
    view.root.replaceChildren(S.fill({ fontFamily: sans }, card, toast.root, pointer.root));

    return (f) => {
      reveals.forEach((apply) => apply(f));
      plansToggle.set(toggleAt(f).offset);
      cardInput.set(cardAt(f));
      terms.set(termsAt(f));
      pay.set(payAt(f), f);
      toast.set(toastAt(f));
      pointer.set(f);
    };
  }
};
