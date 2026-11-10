import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'prompt-send',
  title: 'Prompt send',
  about: 'A glass prompt box grows in with suggestion chips, the camera cuts in as a prompt types, then a hand clicks send and the field blooms.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 165,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Prompt', default: 'Add a text reveal, a soft blur transition, and a gradient background', group: 'Content', maxLength: 300 },
    placeholder: { type: 'string', title: 'Placeholder', default: 'Describe the scene you want…', group: 'Content', maxLength: 120 },
    chips: { type: 'string', title: 'Suggestions (comma separated)', default: 'Add a text reveal, Try a blur transition, Pick a background, Assemble a scene', group: 'Content', maxLength: 400 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    width: { type: 'number', title: 'Panel width (ref px)', default: 636.2, minimum: 200, maximum: 880, step: 0.1, group: 'Style' },
    fieldHeight: { type: 'number', title: 'Field height (ref px)', default: 121.2, minimum: 40, maximum: 400, step: 0.1, group: 'Style' },
    fontSize: { type: 'number', title: 'Prompt size (ref px)', default: 14, minimum: 6, maximum: 60, step: 0.1, group: 'Style' },
    chipFontSize: { type: 'number', title: 'Chip size (ref px)', default: 12.3, minimum: 6, maximum: 40, step: 0.1, group: 'Style' },
    radius: { type: 'number', title: 'Panel radius (ref px)', default: 22, minimum: 0, maximum: 80, step: 0.5, group: 'Style' },
    sendSize: { type: 'number', title: 'Send button (ref px)', default: 27.4, minimum: 10, maximum: 80, step: 0.1, group: 'Style' },
    cursor: { type: 'boolean', title: 'Show hand cursor', default: true, group: 'Style' },
    revealAt: { type: 'number', title: 'Reveal at (s)', default: 0.025, minimum: 0, maximum: 10, step: 0.005, group: 'Motion' },
    typeStart: { type: 'number', title: 'Typing start (s)', default: 0.915, minimum: 0, maximum: 10, step: 0.005, group: 'Motion' },
    typeDuration: { type: 'number', title: 'Typing duration (s)', default: 3.025, minimum: 0, maximum: 20, step: 0.005, group: 'Motion' },
    cutInAt: { type: 'number', title: 'Camera cut in (s)', default: 1.975, minimum: 0, maximum: 20, step: 0.005, group: 'Motion' },
    cutOutAt: { type: 'number', title: 'Camera cut out (s)', default: 4.008, minimum: 0, maximum: 20, step: 0.005, group: 'Motion' },
    zoomIn: { type: 'number', title: 'Cut-in zoom', default: 2.327, minimum: 1, maximum: 5, step: 0.001, group: 'Motion' },
    zoomOut: { type: 'number', title: 'Cut-out zoom', default: 1.44, minimum: 1, maximum: 5, step: 0.001, group: 'Motion' },
    cursorAt: { type: 'number', title: 'Cursor enters (s)', default: 4.042, minimum: 0, maximum: 20, step: 0.005, group: 'Motion' },
    clickAt: { type: 'number', title: 'Click (s)', default: 4.658, minimum: 0, maximum: 20, step: 0.005, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const num = (k: string) => Number(p[k]);
    const REF_W = 890;
    const REF_H = 486;
    const BLEED = 1.4;
    const OX = (REF_W * (BLEED - 1)) / 2;
    const OY = (REF_H * (BLEED - 1)) / 2;
    const PAD = 4.7;
    const PANEL_BIAS = 3.3;
    const LINE_PAD_X = 1.12143;
    const LINE_PAD_Y = 1.27857;
    const LINE_HEIGHT = 1.21429;
    const CARET_RATIO = 0.15714;
    const CHIP_HEIGHT = 2;
    const CHIP_PAD_X = 0.93496;
    const CHIP_GAP = 0.70732;
    const CHIP_TOP = 0.54472;
    const CHIP_INSET = 0.72639;
    const SEND_RIGHT = 14.4;
    const SEND_BOTTOM = 10.3;
    const PANEL_GROW = 0.445;
    const FIELD_GROW = 0.831;
    const WIDEN = 0.2;
    const WIDEN_FROM = 0.93;
    const FIELD_FADE = 0.3;
    const CHIP_DUR = 0.59;
    const CHIP_RISE = 11.4;
    const BLINK = 0.474;
    const PRESS_DOWN = 0.067;
    const PRESS_UP = 0.25;
    const PRESS_SCALE = 0.87;
    const FIELD_AT = 0.417;
    const CARET_AT = 0.742;
    const CHIPS_AT = 0.545;
    const CHIP_STAGGER = 0.1;
    const FOCUS = { x: 0.573, y: 0.4881 };
    const OUT = { x: 0.5305, y: 0.5261 };
    const CURSOR_DURATION = 0.42;
    const REVEAL_EASE = S.Easing.bezier(0.3, 0, 0.35, 1);
    const CHIP_EASE = S.Easing.bezier(0.2, 0, 0.25, 1);
    const CURSOR_EASE = S.Easing.bezier(0.16, 1, 0.3, 1);
    const QUAD_OUT = S.Easing.out(S.Easing.quad);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const text = String(p.text);
    const width = num('width');
    const fieldHeight = num('fieldHeight');
    const fontSize = num('fontSize');
    const chipFontSize = num('chipFontSize');
    const radius = num('radius');
    const sendSize = num('sendSize');
    const revealAt = num('revealAt');
    const typeStart = num('typeStart');
    const typeDuration = num('typeDuration');
    const cutInAt = num('cutInAt');
    const cutOutAt = num('cutOutAt');
    const zoomIn = num('zoomIn');
    const zoomOut = num('zoomOut');
    const cursorAt = num('cursorAt');
    const clickAt = num('clickAt');
    const speed = num('speed');
    const cursor = p.cursor !== false;
    const face = S.pick(p.fontFamily, 'Inter');
    const accent = S.pick(p.accentColor, String(t.primary));
    const bg = String(t.background);
    const card = String(t.card);
    const fg = String(t.foreground);
    const labels = String(p.chips).split(',').map((c) => c.trim()).filter(Boolean);

    const beat = (x: number, at: number, dur: number, ease = REVEAL_EASE) => (dur <= 0 ? (x >= at ? 1 : 0) : S.interpolate(x, [at, at + dur], [0, 1], { ...clamped, easing: ease }));
    const typedCount = (x: number, total: number) => {
      if (x <= typeStart) {
        return 0;
      }
      if (typeDuration <= 0 || x >= typeStart + typeDuration) {
        return total;
      }
      return Math.min(total, Math.round((total * (1 - Math.cos(Math.PI * ((x - typeStart) / typeDuration)))) / 2));
    };
    const typedProgress = (x: number) => (x <= typeStart ? 0 : typeDuration <= 0 || x >= typeStart + typeDuration ? 1 : (1 - Math.cos((Math.PI * (x - typeStart)) / typeDuration)) / 2);
    const keystrokeAt = (count: number, total: number) => (count <= 0 || total <= 0 ? typeStart : typeStart + (typeDuration * Math.acos(1 - 2 * Math.min(1, count / total))) / Math.PI);
    const caretOn = (x: number, anchor: number) => x >= anchor && Math.floor((x - anchor) / BLINK) % 2 === 0;
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const measureWidth = (s: string, size: number) => {
      if (!s) {
        return 0;
      }
      ctx.font = `400 ${size}px ${face}, system-ui, sans-serif`;
      return ctx.measureText(s).width;
    };
    const packRows = (widths: number[], available: number, gap: number) => {
      const rows: number[][] = [];
      let row: number[] = [];
      let used = 0;
      widths.forEach((w, i) => {
        if (row.length > 0 && used + gap + w > available) {
          rows.push(row);
          row = [];
          used = 0;
        }
        used += row.length === 0 ? w : gap + w;
        row.push(i);
      });
      if (row.length > 0) {
        rows.push(row);
      }
      return rows;
    };
    const layout = () => {
      const lineX = PAD + fontSize * LINE_PAD_X;
      const chipHeight = chipFontSize * CHIP_HEIGHT;
      const chipGap = chipFontSize * CHIP_GAP;
      const chipsX = PAD + (lineX - PAD) * CHIP_INSET;
      const chipRows = packRows(labels.map((c) => measureWidth(c, chipFontSize) + chipFontSize * CHIP_PAD_X * 2 + 2), width - chipsX * 2, chipGap);
      const chipsGap = chipFontSize * CHIP_TOP;
      const lineBottom = PAD + fontSize * LINE_PAD_Y + fontSize * LINE_HEIGHT;
      const sendTop = PAD + fieldHeight - SEND_BOTTOM - sendSize;
      const gutter = lineBottom > sendTop ? sendSize + SEND_RIGHT + fontSize * 0.5 : 0;
      const below = chipRows.length === 0 ? PAD : chipsGap + chipRows.length * chipHeight + (chipRows.length - 1) * chipGap + PAD * 2;
      const panelHeight = PAD + fieldHeight + below;
      return { panelTop: (REF_H - panelHeight) / 2 + PANEL_BIAS, panelHeight, lineX, lineY: PAD + fontSize * LINE_PAD_Y, lineHeight: fontSize * LINE_HEIGHT, lineMaxWidth: Math.max(0, width - lineX * 2 - gutter), caretWidth: fontSize * CARET_RATIO, chipsX, chipsGap, chipHeight, chipGap, chipRows };
    };

    const hairline = S.mixOklch(String(t.input), bg, 0.1);
    const sendIdle = S.mixOklch(fg, card, 0.55);
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);
    const wash = S.h('div', { style: { position: 'absolute', left: -OX, top: -OY, width: REF_W * BLEED, height: REF_H * BLEED, background: bg, backgroundImage: [`radial-gradient(${0.96 * REF_W}px ${0.8 * REF_H}px at ${OX + 0.06 * REF_W}px ${OY + 0.98 * REF_H}px, ${S.withAlpha(bg, 0.9)} 0%, transparent 62%)`, `radial-gradient(${0.74 * REF_W}px ${0.62 * REF_H}px at ${OX + 0.1 * REF_W}px ${OY + 0.46 * REF_H}px, ${S.withAlpha(card, 0.42)} 0%, transparent 66%)`, `linear-gradient(215deg, ${S.withAlpha(accent, 0.5)} 0%, ${S.withAlpha(accent, 0.28)} 52%, ${S.withAlpha(accent, 0.14)} 100%)`].join(',') } });
    const glowEl = S.h('div', { style: { position: 'absolute', inset: 0 } }) as HTMLElement;
    const typedNode = document.createTextNode('');
    const caretEl = S.h('span', { style: { display: 'inline-block', background: fg, flexShrink: 0 } }) as HTMLElement;
    const placeholderEl = S.h('span', { style: { color: String(t.mutedForeground) } }, String(p.placeholder)) as HTMLElement;
    const lineEl = S.h('div', { style: { position: 'absolute', display: 'flex', alignItems: 'center', fontFamily: face, fontWeight: 400, fontSize, color: fg, whiteSpace: 'pre', textRendering: 'geometricPrecision' } }, typedNode, caretEl, placeholderEl) as HTMLElement;
    const arrow = sendSize * 0.56;
    const sendEl = S.h('div', { style: { position: 'absolute', right: SEND_RIGHT, bottom: SEND_BOTTOM, width: sendSize, height: sendSize, borderRadius: sendSize / 2, display: 'flex', alignItems: 'center', justifyContent: 'center' } }) as HTMLElement;
    sendEl.innerHTML = `<svg viewBox="0 0 24 24" width="${arrow}" height="${arrow}" fill="none" stroke="${card}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>`;
    const fieldEl = S.h('div', { style: { position: 'absolute', left: PAD, top: PAD, background: S.withAlpha(card, 0.94), boxShadow: `0 6px 18px ${S.withAlpha(fg, 0.05)}`, overflow: 'hidden' } }, glowEl, lineEl, sendEl) as HTMLElement;
    const chipsEl = S.h('div', { style: { position: 'absolute', display: 'flex', flexDirection: 'column' } }) as HTMLElement;
    const panelEl = S.h('div', { style: { position: 'absolute', borderRadius: radius, background: S.withAlpha(card, 0.52), boxShadow: `inset 0 0 0 1px ${S.withAlpha(card, 0.6)}, 0 12px 32px ${S.withAlpha(fg, 0.05)}`, overflow: 'hidden' } }, fieldEl, chipsEl) as HTMLElement;
    const camera = S.h('div', { style: { position: 'absolute', inset: 0, transformOrigin: '0 0' } }, wash, panelEl) as HTMLElement;
    const hand = document.createElement('div');
    hand.style.cssText = 'position:absolute;left:0;top:0';
    hand.innerHTML = `<svg viewBox="0 0 18 27" width="${27 * (18 / 27)}" height="27" style="position:absolute;left:${-27 * (6.2 / 27)}px;top:${-27 * (1 / 27)}px;display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.28))"><path d="M4.1 15.6V3.1a2.1 2.1 0 0 1 4.2 0v7.6h.6l.3-1.5a1.7 1.7 0 0 1 3.4.3v1.5l.4-.5a1.7 1.7 0 0 1 3 1.1v1.1l.4-.2a1.6 1.6 0 0 1 1.9 1.6v4.6c0 3.6-2.4 6.3-6.1 6.3H9.6c-2.6 0-4-1-5.2-2.7l-3.2-4.6a1.7 1.7 0 0 1 2.5-2.2l.4.4Z" fill="${card}" stroke="${S.mixOklch(fg, card, 0.2)}" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: REF_W, height: REF_H, transform: `translate(-50%, -50%) scale(${stageScale})`, overflow: 'hidden' } }, camera, hand);
    view.root.replaceChildren(S.fill({ background: bg, fontOpticalSizing: 'none' }, stage));

    let rowsKey = '';
    let chipEls: HTMLElement[] = [];
    const buildChips = (L: ReturnType<typeof layout>) => {
      const key = JSON.stringify(L.chipRows);
      if (key === rowsKey) {
        return;
      }
      rowsKey = key;
      chipEls = [];
      chipsEl.replaceChildren(
        ...L.chipRows.map((row) =>
          S.h(
            'div',
            { style: { display: 'flex', gap: L.chipGap } },
            row.map((i) => {
              const el = S.h('div', { style: { boxSizing: 'border-box', height: L.chipHeight, padding: `0 ${chipFontSize * CHIP_PAD_X}px`, borderRadius: L.chipHeight / 2, background: card, border: `1px solid ${hairline}`, color: fg, fontFamily: face, fontWeight: 400, fontSize: chipFontSize, paddingTop: chipFontSize * 0.17073, lineHeight: `${L.chipHeight - 4}px`, whiteSpace: 'nowrap', textRendering: 'geometricPrecision' } }, labels[i]) as HTMLElement;
              chipEls[i] = el;
              return el;
            })
          )
        )
      );
    };

    return (frame) => {
      const now = (frame * speed) / view.fps;
      const L = layout();
      buildChips(L);
      const panelH = L.panelHeight * beat(now, revealAt, PANEL_GROW);
      const fieldH = fieldHeight * beat(now, revealAt, PANEL_GROW * FIELD_GROW);
      const panelW = width * (WIDEN_FROM + (1 - WIDEN_FROM) * beat(now, revealAt, WIDEN));
      const panelLeft = (REF_W - panelW) / 2;
      const fieldIn = S.interpolate(now, [FIELD_AT, FIELD_AT + FIELD_FADE], [0, 1], clamped);
      const count = typedCount(now, text.length);
      const advance = measureWidth(text, fontSize) * typedProgress(now);
      const room = Math.max(0, L.lineMaxWidth - L.caretWidth);
      const scrolled = Math.max(0, advance - room);
      const caretX = panelLeft + L.lineX + Math.min(advance, room);
      const anchor = count === 0 ? CARET_AT : Math.min(now, Math.max(CARET_AT, keystrokeAt(count - 0.5, text.length)));
      const caretLit = now >= CARET_AT && caretOn(now, anchor);
      const sendX = panelLeft + panelW - PAD - SEND_RIGHT - sendSize / 2;
      const sendY = L.panelTop + PAD + fieldHeight - SEND_BOTTOM - sendSize / 2;
      const caretY = L.panelTop + L.lineY + L.lineHeight / 2;
      const shot = now >= cutOutAt ? { scale: zoomOut, x: OUT.x * REF_W - zoomOut * sendX, y: OUT.y * REF_H - zoomOut * sendY } : now >= cutInAt ? { scale: zoomIn, x: FOCUS.x * REF_W - zoomIn * caretX, y: FOCUS.y * REF_H - zoomIn * caretY } : { scale: 1, x: 0, y: 0 };
      const approach = S.interpolate(now, [cursorAt, cursorAt + CURSOR_DURATION], [0, 1], { ...clamped, easing: CURSOR_EASE });
      const press = !cursor || now < clickAt ? 0 : now < clickAt + PRESS_DOWN ? (now - clickAt) / PRESS_DOWN : Math.max(0, 1 - (now - clickAt - PRESS_DOWN) / PRESS_UP);
      const glow = cursor ? beat(now, clickAt + 0.22, 0.3, QUAD_OUT) : 0;
      const sweep = beat(now, clickAt + 0.22, 1.1, QUAD_OUT);

      camera.style.transform = `translate(${shot.x}px, ${shot.y}px) scale(${shot.scale})`;
      Object.assign(panelEl.style, { left: `${panelLeft}px`, top: `${L.panelTop}px`, width: `${panelW}px`, height: `${panelH}px` });
      Object.assign(fieldEl.style, { width: `${Math.max(0, panelW - PAD * 2)}px`, height: `${fieldH}px`, borderRadius: `${Math.max(0, radius - 2)}px` });
      glowEl.style.opacity = String(glow);
      glowEl.style.background = `radial-gradient(80% 170% at ${16 + sweep * 66}% 96%, ${S.withAlpha(accent, 0.55)} 0%, transparent 66%)`;
      Object.assign(lineEl.style, { left: `${L.lineX - PAD - scrolled}px`, top: `${L.lineY - PAD}px`, height: `${L.lineHeight}px`, lineHeight: `${L.lineHeight}px` });
      typedNode.data = text.slice(0, count);
      Object.assign(caretEl.style, { width: `${L.caretWidth}px`, height: `${L.lineHeight}px`, opacity: caretLit ? '1' : '0' });
      placeholderEl.style.display = count === 0 ? '' : 'none';
      placeholderEl.style.opacity = String(fieldIn);
      sendEl.style.background = count > 0 ? fg : sendIdle;
      sendEl.style.opacity = String(fieldIn);
      sendEl.style.transform = `scale(${1 - (1 - PRESS_SCALE) * press})`;
      Object.assign(chipsEl.style, { left: `${L.chipsX}px`, right: `${L.chipsX}px`, top: `${PAD + fieldH + L.chipsGap}px`, gap: `${L.chipGap}px` });
      chipEls.forEach((el, i) => {
        const k = beat(now, CHIPS_AT + i * CHIP_STAGGER, CHIP_DUR, CHIP_EASE);
        el.style.opacity = String(k);
        el.style.transform = `translateY(${(1 - k) * CHIP_RISE}px)`;
      });

      const show = cursor && approach > 0;
      hand.style.display = show ? 'block' : 'none';
      const hx = S.interpolate(approach, [0, 1], [REF_W * 0.86, shot.x + shot.scale * sendX + sendSize * 0.098]);
      const hy = S.interpolate(approach, [0, 1], [REF_H * 1.02, shot.y + shot.scale * sendY - sendSize * 0.091]);
      hand.style.transform = `translate(${hx}px, ${hy}px)`;
    };
  }
};
