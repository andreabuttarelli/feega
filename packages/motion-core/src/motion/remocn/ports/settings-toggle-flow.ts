import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'settings-toggle-flow',
  title: 'Settings toggle flow',
  about: 'A cursor flips a switch, picks a theme from a dropdown, drags a volume slider and saves, ending on a success toast.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 320,
  background: '#f5f5f5',
  fonts: ['Geist'],
  props: {
    title: { type: 'string', title: 'Title', default: "Notification settings", group: 'Content', maxLength: 60 },
    description: { type: 'string', title: 'Description', default: "Manage how you receive alerts, set your theme, and tune the volume.", group: 'Content', maxLength: 140 },
    rows: { type: 'string', title: 'Row labels (comma separated)', default: "Notifications, Theme, Volume", group: 'Content', maxLength: 80 },
    selectItems: { type: 'string', title: 'Theme options (comma separated)', default: "System, Light, Dark", group: 'Content', maxLength: 80 },
    saveLabel: { type: 'string', title: 'Save label', default: "Save settings", group: 'Content', maxLength: 30 },
    toastTitle: { type: 'string', title: 'Toast', default: "Settings saved", group: 'Content', maxLength: 50 },
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

    const selectStyleOf = (state: string): V => (state === 'opened' ? { opacity: 1, scale: 1, ty: 0, turn: 180 } : { opacity: 0, scale: 0.96, ty: -4, turn: 0 });
    const rowStyleOf = (state: string): V => {
      const hover = T.mut;
      if (state === 'hover') {
        return { bg: hover, fg: T.fg, check: 0, scale: 1 };
      }
      if (state === 'press') {
        return { bg: mix(hover, T.fg, 0.08), fg: T.fg, check: 0, scale: 0.98 };
      }
      if (state === 'selected') {
        return { bg: hover, fg: T.fg, check: 1, scale: 1 };
      }
      return { bg: T.bg, fg: T.fg, check: 0, scale: 1 };
    };
    const MENU_W = 260;
    const mkSelect = (caption: string, options: string[]) => {
      const chevron = svg(16, S.h('path', { d: 'M6 9l6 6 6-6', stroke: T.mutFg, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
      chevron.style.flexShrink = '0';
      const trigger = el('div', { width: MENU_W, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 40, padding: '0 16px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.fg, border: `1px solid ${T.bor}`, borderRadius: T.radius }, el('span', {}, caption), chevron);
      const rows = options.map((option) => {
        const mark = svg(16, S.h('path', { d: CHECK_PATH, stroke: T.pri, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }));
        mark.style.flexShrink = '0';
        return { row: el('div', { width: MENU_W - 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: T.radius, fontSize: 14, letterSpacing: '-0.01em' }, el('span', {}, option), mark), mark };
      });
      const panel = el('div', { position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: MENU_W, boxSizing: 'border-box', transformOrigin: 'top', background: T.bg, border: `1px solid ${T.bor}`, borderRadius: T.radius, padding: 4, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0 16px 32px -12px rgba(0,0,0,0.25)', opacity: 0 }, rows.map((r) => r.row));
      return {
        root: centre({}, el('div', { position: 'relative', width: MENU_W }, trigger, panel)),
        setPanel: (v: V) => {
          panel.style.opacity = String(v.opacity);
          panel.style.transform = `translateY(${v.ty}px) scale(${v.scale})`;
          chevron.style.transform = `rotate(${v.turn}deg)`;
        },
        setTrigger: (v: V) => {
          trigger.style.transform = `translateY(${v.ty}px) scale(${v.scale})`;
          trigger.style.background = v.bg;
        },
        setRow: (i: number, v: V) => {
          rows[i].row.style.transform = `scale(${v.scale})`;
          rows[i].row.style.background = v.bg;
          rows[i].row.style.color = v.fg;
          rows[i].mark.style.opacity = String(v.check);
        }
      };
    };

    type Tween = { at: number; value?: number; thumb?: string; duration?: number; inOut?: boolean };
    const THUMBS: Record<string, V> = { idle: { scale: 1, glow: 0 }, hover: { scale: 1.1, glow: 1 }, press: { scale: 1.15, glow: 1 } };
    const channelAt = (steps: Tween[], f: number, read: (s: Tween) => V | number, join: (a: any, b: any, k: number) => any) => {
      const first = steps[0];
      if (f <= first.at) {
        return read(first);
      }
      let toIndex = steps.length - 1;
      for (let i = 1; i < steps.length; i++) {
        if (steps[i].at > f) {
          toIndex = i;
          break;
        }
      }
      const last = steps[steps.length - 1];
      const past = f >= last.at;
      const to = past ? last : steps[toIndex];
      const from = past ? last : steps[toIndex - 1];
      const dur = to.duration ?? 18;
      const ease = to.inOut ? easeInOut : easeOut;
      return join(read(from), read(to), past || dur <= 0 ? 1 : ease(clamp01((f - (to.at - dur)) / dur)));
    };
    const sliderAt = (steps: Tween[], f: number) => ({
      value: channelAt(steps.filter((s) => s.value !== undefined), f, (s) => s.value as number, (a, b, k) => lerp(a, b, k)) as number,
      thumb: channelAt(steps.filter((s) => s.thumb !== undefined), f, (s) => THUMBS[s.thumb as string], (a, b, k) => tween(a, b, k)) as V
    });
    const mkSlider = (width: number) => {
      const TRACK_H = 8;
      const THUMB_W = 24;
      const THUMB_H = 16;
      const GLOW = 4;
      const range = el('div', { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_H / 2, background: T.pri });
      const glow = el('div', { position: 'absolute', left: '50%', top: '50%', width: THUMB_W + GLOW * 2, height: THUMB_H + GLOW * 2, transform: 'translate(-50%, -50%)', borderRadius: THUMB_H / 2 + GLOW, background: mix(T.ring, T.bg, 0.7), opacity: 0 });
      const knob = el('div', { position: 'absolute', left: 0, top: '50%' }, glow, el('div', { position: 'relative', width: THUMB_W, height: THUMB_H, borderRadius: THUMB_H / 2, background: '#ffffff', boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0,0,0,0.18)' }));
      return {
        root: el('div', { position: 'relative', display: 'inline-flex', alignItems: 'center', width, height: THUMB_H, fontFamily: sans }, el('div', { position: 'relative', width: '100%', height: TRACK_H, borderRadius: TRACK_H / 2, background: mix(T.bor, T.bg, 0.1) }, range), knob),
        set: (v: V) => {
          const pct = clamp01(v.value / 100) * 100;
          range.style.width = `${pct}%`;
          knob.style.left = `${pct}%`;
          knob.style.transform = `translate(-50%, -50%) scale(${v.thumb.scale})`;
          glow.style.opacity = String(v.thumb.glow);
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

    const list = (value: unknown) => String(value).split(',').map((s) => s.trim()).filter(Boolean);
    const rows = list(p.rows);
    const options = list(p.selectItems);
    const DEMO = 44;
    const LEFT_X = 320;
    const RIGHT_X = 700;
    const COL_W = 300;
    const NOTIF_LABEL_Y = 196;
    const SWITCH_TOP = 222;
    const SWITCH_W = 44;
    const SWITCH_H = 28;
    const SWITCH_CX = RIGHT_X + SWITCH_W / 2;
    const SWITCH_CY = SWITCH_TOP + SWITCH_H / 2;
    const THEME_LABEL_Y = 280;
    const SELECT_W = 260;
    const TRIGGER_TOP = 320;
    const TRIGGER_H = 40;
    const TRIGGER_CX = RIGHT_X + SELECT_W / 2;
    const TRIGGER_CY = TRIGGER_TOP + TRIGGER_H / 2;
    const PANEL_TOP = TRIGGER_TOP + TRIGGER_H + 6;
    const PANEL_PAD = 4;
    const ITEM_H = 33;
    const ITEM_GAP = 2;
    const VOL_LABEL_Y = 380;
    const SLIDER_TOP = 400;
    const SLIDER_H = 16;
    const SLIDER_CY = SLIDER_TOP + SLIDER_H / 2;
    const THUMB_X_AT_20 = RIGHT_X + 0.2 * SELECT_W;
    const THUMB_X_AT_80 = RIGHT_X + 0.8 * SELECT_W;
    const SAVE_W = 160;
    const SAVE_LEFT = RIGHT_X + SELECT_W - SAVE_W;
    const SAVE_TOP = 544;
    const SAVE_H = 40;
    const SAVE_CX = SAVE_LEFT + SAVE_W / 2;
    const SAVE_CY = SAVE_TOP + SAVE_H / 2;
    const CARD_PAD = 44;
    const CARD_LEFT = LEFT_X - CARD_PAD;
    const CARD_TOP = NOTIF_LABEL_Y - CARD_PAD;
    const CARD_W = RIGHT_X + SELECT_W + CARD_PAD - CARD_LEFT;
    const CARD_H = SAVE_TOP + SAVE_H + CARD_PAD - CARD_TOP;
    const lastItem = options.length - 1;
    const ITEM_CY = PANEL_TOP + PANEL_PAD + lastItem * (ITEM_H + ITEM_GAP) + ITEM_H / 2;

    const alerts = mkSwitch('');
    const choice = mkSelect(options[0] ?? 'System', options);
    const volume = mkSlider(SELECT_W);
    const save = mkButton(String(p.saveLabel), 'center');
    const toast = mkToast(String(p.toastTitle), 24, 24);
    const pointer = mkCursor([
      { at: 0, x: 220, y: 130 },
      { at: 24 + DEMO, x: SWITCH_CX, y: SWITCH_CY, duration: 20 },
      { at: 24 + DEMO, x: SWITCH_CX, y: SWITCH_CY, click: true, duration: 0 },
      { at: 55 + DEMO, x: TRIGGER_CX, y: TRIGGER_CY, duration: 22 },
      { at: 55 + DEMO, x: TRIGGER_CX, y: TRIGGER_CY, click: true, duration: 0 },
      { at: 80 + DEMO, x: TRIGGER_CX, y: ITEM_CY, duration: 18 },
      { at: 80 + DEMO, x: TRIGGER_CX, y: ITEM_CY, click: true, duration: 0 },
      { at: 105 + DEMO, x: THUMB_X_AT_20, y: SLIDER_CY, duration: 18 },
      { at: 105 + DEMO, x: THUMB_X_AT_20, y: SLIDER_CY, press: true, duration: 0 },
      { at: 150 + DEMO, x: THUMB_X_AT_80, y: SLIDER_CY, press: true, duration: 45 },
      { at: 158 + DEMO, x: THUMB_X_AT_80, y: SLIDER_CY, duration: 0 },
      { at: 180 + DEMO, x: SAVE_CX, y: SAVE_CY, duration: 18 },
      { at: 180 + DEMO, x: SAVE_CX, y: SAVE_CY, click: true, duration: 0 }
    ]);

    const alertsAt = anim([{ at: 24 + DEMO, state: 'checked', duration: 12 }], 'unchecked', 10, switchStyleOf);
    const panelAt = anim([{ at: 55 + DEMO, state: 'opened', duration: 14 }, { at: 90 + DEMO, state: 'closed', duration: 12 }], 'closed', 12, selectStyleOf);
    const triggerAt = anim([{ at: 45 + DEMO, state: 'hover', duration: 8 }, { at: 55 + DEMO, state: 'press', duration: 8 }], 'idle', 8, buttonStyleOf(true));
    const rowAt = anim([{ at: 68 + DEMO, state: 'hover', duration: 8 }, { at: 78 + DEMO, state: 'press', duration: 6 }, { at: 80 + DEMO, state: 'selected', duration: 10 }], 'idle', 8, rowStyleOf);
    const sliderSteps = [{ at: 0, value: 20, thumb: 'idle' }, { at: 105 + DEMO, thumb: 'press', duration: 6 }, { at: 105 + DEMO, value: 20 }, { at: 150 + DEMO, value: 80, duration: 45, inOut: true }, { at: 158 + DEMO, thumb: 'idle', duration: 8 }];
    const saveAt = anim([{ at: 172 + DEMO, state: 'hover', duration: 8 }, { at: 180 + DEMO, state: 'press', duration: 6 }, { at: 188 + DEMO, state: 'success', duration: 14 }], 'idle', 8, buttonStyleOf(false));
    const toastAt = anim([{ at: 196 + DEMO, state: 'visible', duration: 12 }, { at: 256 + DEMO, state: 'hidden', duration: 12 }], 'hidden', 12, toastStyleOf);

    const rowLabel = (top: number, value: string) => text('div', { position: 'absolute', left: RIGHT_X, top, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', color: T.fg }, value);
    const at = (left: number, top: number, width: number, height: number, kid: any) => el('div', { position: 'absolute', left, top, width, height }, kid);
    const card = el('div', { position: 'absolute', left: CARD_LEFT, top: CARD_TOP, width: CARD_W, height: CARD_H, boxSizing: 'border-box', background: T.bg, border: `1px solid ${T.bor}`, borderRadius: 16, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.22), 0 2px 8px -3px rgba(0,0,0,0.10)' });
    const header = el('div', { position: 'absolute', left: LEFT_X, top: NOTIF_LABEL_Y, width: COL_W, display: 'flex', flexDirection: 'column', gap: 10 }, text('div', { fontSize: 22, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: T.fg }, String(p.title)), text('div', { fontSize: 14, lineHeight: '22px', color: T.mutFg }, String(p.description)));
    const notifLabel = rowLabel(NOTIF_LABEL_Y, rows[0] ?? 'Notifications');
    const notifSwitch = at(RIGHT_X, SWITCH_TOP, SWITCH_W, SWITCH_H, alerts.root);
    const volumeLabel = rowLabel(VOL_LABEL_Y, rows[2] ?? 'Volume');
    const volumeSlider = el('div', { position: 'absolute', left: RIGHT_X, top: SLIDER_TOP }, volume.root);
    const themeLabel = rowLabel(THEME_LABEL_Y, rows[1] ?? 'Theme');
    const themeSelect = at(RIGHT_X, TRIGGER_TOP, SELECT_W, TRIGGER_H, choice.root);
    const saveBox = at(SAVE_LEFT, SAVE_TOP, SAVE_W, SAVE_H, save.root);
    const reveals = [reveal(card, 0, 18, 0), reveal(header, 18), reveal(notifLabel, 24), reveal(notifSwitch, 24), reveal(themeLabel, 30), reveal(themeSelect, 30), reveal(volumeLabel, 36), reveal(volumeSlider, 36), reveal(saveBox, 42)];
    view.root.replaceChildren(S.fill({ fontFamily: sans }, card, header, notifLabel, notifSwitch, volumeLabel, volumeSlider, themeLabel, themeSelect, saveBox, toast.root, pointer.root));

    return (f) => {
      reveals.forEach((apply) => apply(f));
      alerts.set(alertsAt(f));
      choice.setPanel(panelAt(f));
      choice.setTrigger(triggerAt(f));
      options.forEach((_, i) => choice.setRow(i, i === lastItem ? rowAt(f) : rowStyleOf('idle')));
      volume.set(sliderAt(sliderSteps, f));
      save.set(saveAt(f), f);
      toast.set(toastAt(f));
      pointer.set(f);
    };
  }
};
