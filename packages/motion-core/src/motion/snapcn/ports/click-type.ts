import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'click-type',
  title: 'Click type',
  about: 'A cursor clicks a prompt composer, then a close-up cut types the real prompt at the caret and arms the send button.',
  category: SnapcnCategory.Cursor,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    placeholder: { type: 'string', title: 'Placeholder', default: 'Describe what you want to build...', group: 'Content', maxLength: 120 },
    prompt: { type: 'string', title: 'Prompt', default: 'Build me a marketing site', group: 'Content', maxLength: 120 },
    hint: { type: 'string', title: 'Hint', default: 'New suggestion', group: 'Content', maxLength: 60 },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const W = view.width;
    const H = view.height;
    const s = H / 720;
    const speed = Number(p.speed);
    const placeholder = String(p.placeholder);
    const prompt = String(p.prompt);
    const fg = String(t.foreground);
    const card = String(t.card);
    const bg = String(t.background);
    const muted = String(t.mutedForeground);
    const accent = S.pick(p.accentColor, String(t.primary));
    const face = S.pick(p.fontFamily, 'Inter');

    const CLICK_AT = 30;
    const CUT_AT = 34;
    const TYPE_AT = CUT_AT + 4;
    const PANEL_W = 920;
    const PANEL_H = 260;
    const PAD = 7;
    const RADIUS = 32;
    const PAD_X = 34;
    const PAD_Y = 34;
    const TEXT = 30;
    const SEND = 46;
    const ZOOM = 1.9;
    const FOCUS = { x: 0.2, y: 0.4 };
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CURSOR_EASE = S.Easing.inOut(S.Easing.cubic);
    const RING_EASE = S.Easing.out(S.Easing.cubic);

    const strokes: number[] = [];
    let total = 0;
    for (const ch of prompt) {
      strokes.push(total);
      total += ch === ' ' ? 2 : 1;
    }

    const glassy = S.withAlpha(card, 0.52);
    const surface = S.withAlpha(card, 0.94);
    const hairline = S.mixOklch(String(t.input), bg, 0.1);
    const sendIdle = S.mixOklch(fg, card, 0.55);

    const panelX = (W - PANEL_W * s) / 2;
    const panelY = (H - PANEL_H * s) / 2;
    const fieldX = panelX + PAD * s;
    const fieldY = panelY + PAD * s;
    const fieldW = (PANEL_W - PAD * 2) * s;
    const fieldH = (PANEL_H - PAD * 2) * s;
    const textX = fieldX + PAD_X * s;
    const textY = fieldY + PAD_Y * s;

    const glyph = (d: string, color: string, size: number, stroke = 1.8) =>
      S.h('svg', { viewBox: '0 0 24 24', width: size, height: size, style: { display: 'block' } }, S.h('path', { d, fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    const iconButton = (d: string) =>
      S.h('div', { style: { width: SEND * s, height: SEND * s, boxSizing: 'border-box', borderRadius: 999, border: `1px solid ${hairline}`, background: card, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, glyph(d, muted, 22 * s));

    const wash = S.h('div', {
      style: {
        position: 'absolute', left: -0.2 * W, top: -0.2 * H, width: 1.4 * W, height: 1.4 * H, background: bg,
        backgroundImage: [
          `radial-gradient(${0.96 * W}px ${0.8 * H}px at ${0.26 * W}px ${1.18 * H}px, ${S.withAlpha(bg, 0.9)} 0%, transparent 62%)`,
          `radial-gradient(${0.74 * W}px ${0.62 * H}px at ${0.3 * W}px ${0.66 * H}px, ${S.withAlpha(card, 0.42)} 0%, transparent 66%)`,
          `linear-gradient(215deg, ${S.withAlpha(accent, 0.5)} 0%, ${S.withAlpha(accent, 0.28)} 52%, ${S.withAlpha(accent, 0.14)} 100%)`
        ].join(',')
      }
    });

    const typedEl = S.h('span', { style: { color: fg, whiteSpace: 'pre' } }) as HTMLElement;
    const caret = S.h('span', { style: { display: 'inline-block', flexShrink: 0, width: Math.max(1.5, 2.4 * s), height: TEXT * 1.15 * s, borderRadius: 1, background: fg, marginLeft: 2 * s } }) as HTMLElement;
    const placeEl = S.h('span', { style: { color: muted, whiteSpace: 'pre' } }) as HTMLElement;
    const send = S.h('div', { style: { width: SEND * s, height: SEND * s, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, glyph('M12 19V5M5.5 11.5 12 5l6.5 6.5', card, SEND * 0.52 * s, 2.2)) as HTMLElement;

    const content = S.fill({},
      S.h('div', { style: { position: 'absolute', left: panelX, top: panelY, width: PANEL_W * s, height: PANEL_H * s, borderRadius: RADIUS * s, background: glassy, boxShadow: `inset 0 0 0 1px ${S.withAlpha(card, 0.6)}, 0 ${12 * s}px ${32 * s}px ${S.withAlpha(fg, 0.05)}` } }),
      S.h('div', { style: { position: 'absolute', left: fieldX, top: fieldY, width: fieldW, height: fieldH, borderRadius: (RADIUS - 2) * s, background: surface, boxShadow: `0 ${6 * s}px ${18 * s}px ${S.withAlpha(fg, 0.05)}` } }),
      S.h('div', { style: { position: 'absolute', left: textX, top: textY, right: W - (fieldX + fieldW) + PAD_X * s, fontSize: TEXT * s, lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.01em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' } }, typedEl, caret, placeEl),
      S.h('div', { style: { position: 'absolute', left: textX, right: W - (fieldX + fieldW) + 18 * s, top: fieldY + fieldH - (SEND + 18) * s, height: SEND * s, display: 'flex', alignItems: 'center', gap: 10 * s, fontSize: 19 * s, fontWeight: 500, color: muted } },
        glyph('M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5', muted, 18 * s, 2),
        S.h('span', { style: { flex: 1 } }, String(p.hint)),
        iconButton('M12 7v10M7 12h10'),
        iconButton('M12 4.5a2.5 2.5 0 0 0-2.5 2.5v4.5a2.5 2.5 0 0 0 5 0V7A2.5 2.5 0 0 0 12 4.5zM7 11a5 5 0 0 0 10 0M12 16v3'),
        send)
    ) as HTMLElement;
    const camera = S.fill({ transformOrigin: '0 0' }, wash, content) as HTMLElement;

    const ch = H * 0.039;
    const box = (ch * 24) / 14;
    const off = (-ch * 5.5) / 14;
    const ARROW = 'M5.5 5.5 19 11l-5.6 1.45a2 2 0 0 0-1.45 1.45L10.5 19.5z';
    const ring = S.h('div', { style: { position: 'absolute', borderRadius: '50%', border: `${Math.max(1.5, ch * 0.07)}px solid ${t.primary}`, backgroundColor: S.withAlpha(String(t.primary), 0.12) } }) as HTMLElement;
    const arrow = document.createElement('div');
    arrow.innerHTML = `<svg viewBox="0 0 24 24" width="${box}" height="${box}" style="position:absolute;left:${off}px;top:${off}px;display:block;overflow:visible"><defs><filter id="ct-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-opacity="0.35"/></filter></defs><g filter="url(#ct-shadow)"><path d="${ARROW}" fill="${bg}" stroke="${bg}" stroke-width="5" stroke-linejoin="round"/><path d="${ARROW}" fill="${fg}" stroke="${fg}" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
    const pointer = S.h('div', { style: { position: 'absolute', left: 0, top: 0 } }, ring, arrow.firstChild as Element) as HTMLElement;
    const cursorLayer = S.fill({ pointerEvents: 'none' }, pointer) as HTMLElement;

    view.root.replaceChildren(S.fill({ background: bg, fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision', overflow: 'hidden' }, camera, cursorLayer));

    const target = { x: (textX + 8 * s) / W, y: (textY + TEXT * 0.9 * s) / H };
    const pose = (frame: number) => {
      const opacity = S.interpolate(frame, [6, 10], [0, 1], { ...CLAMP, easing: RING_EASE });
      let x = -0.04;
      let y = 0.62;
      if (frame >= 10) {
        const k = S.interpolate(frame, [10, CLICK_AT], [0, 1], { ...CLAMP, easing: CURSOR_EASE });
        x += (target.x - x) * k;
        y += (target.y - y) * k;
      }
      const click = frame >= CLICK_AT && frame < CLICK_AT + 14 ? (frame - CLICK_AT + 1) / 14 : 0;
      return { x, y, click, opacity };
    };

    return (at) => {
      const frame = at * speed;
      const close = frame >= CUT_AT;
      const shown = Math.max(0, Math.floor((frame - 4) * 1.5));
      const typed = strokes.filter((a) => frame >= TYPE_AT + a).length;
      const enter = S.interpolate(frame, [0, 12], [0, 1], { ...CLAMP, easing: EASE });

      camera.style.transform = close ? `translate(${FOCUS.x * W - textX * ZOOM}px, ${FOCUS.y * H - textY * ZOOM}px) scale(${ZOOM})` : 'none';
      content.style.opacity = String(close ? 1 : enter);
      content.style.transform = close ? '' : `translateY(${(1 - enter) * 14 * s}px)`;

      typedEl.style.display = close ? '' : 'none';
      caret.style.display = close ? '' : 'none';
      placeEl.style.display = close ? 'none' : '';
      typedEl.textContent = prompt.slice(0, typed);
      placeEl.textContent = placeholder.slice(0, shown);
      const blink = typed === 0 || typed === prompt.length;
      caret.style.opacity = blink ? String(Math.floor(at / (view.fps / 1.6 / 2)) % 2 === 0 ? 1 : 0) : '1';
      send.style.background = close && typed > 0 ? fg : sendIdle;

      const c = pose(frame);
      cursorLayer.style.display = close || c.opacity <= 0 ? 'none' : '';
      pointer.style.opacity = String(c.opacity);
      pointer.style.transform = `translate(${c.x * W}px, ${c.y * H}px)`;
      const r = S.interpolate(c.click, [0, 1], [ch * 0.18, ch * 1.1], { ...CLAMP, easing: RING_EASE });
      ring.style.display = c.click > 0 ? '' : 'none';
      ring.style.left = `${-r}px`;
      ring.style.top = `${-r}px`;
      ring.style.width = `${r * 2}px`;
      ring.style.height = `${r * 2}px`;
      ring.style.opacity = String(1 - c.click);
    };
  }
};
