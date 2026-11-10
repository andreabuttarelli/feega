import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'roster-grant',
  title: 'Roster grant',
  about: 'Three rows of roster cards drift past a pill, a pointer clicks it, and the monograms light up one card at a time.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    row1: { type: 'string', title: 'Row 1 (Name / Role, comma separated)', default: 'Text Reveal / Animation, Prompt Send / Composition, Logo Drift / Background, Word Flip / Animation', group: 'Content', maxLength: 400 },
    row2: { type: 'string', title: 'Row 2 (Name / Role, comma separated)', default: 'Count Grid / Composition, Agent Steps / Composition, Type Morph / Animation, Text Swell / Animation', group: 'Content', maxLength: 400 },
    row3: { type: 'string', title: 'Row 3 (Name / Role, comma separated)', default: 'Karaoke Captions / Composition, Search Typing / Composition, Text Highlight / Animation, Orbit Gallery / Composition', group: 'Content', maxLength: 400 },
    label: { type: 'string', title: 'Pill label', default: 'Install all', group: 'Content', maxLength: 40 },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const th = S.themeOf(String(p.mode));
    const accent = S.pick(p.accentColor, String(th.primary));
    const face = S.pick(p.fontFamily, 'Inter');
    const label = String(p.label);
    const speed = Number(p.speed);
    const REF_W = 712;
    const REF_H = 398;
    const ORIGIN = { x: 356, y: 200 };
    const ROW_PITCH = 109.5;
    const CARD = { w: 286, h: 76, radius: 8, gap: 26 };
    const CARD_PITCH = CARD.w + CARD.gap;
    const AVATAR = { size: 48, padX: 17.5, initials: 24 };
    const TEXT_X = AVATAR.padX + AVATAR.size + 12;
    const PILL = { h: 43, radius: 8, padX: 43, label: 20, wordSpacing: 5, iconGap: 22, iconW: 24, iconH: 20 };
    const CURSOR = { size: 22, tip: { x: 4.04, y: 4.69 } };
    const TAU = 0.753;
    const ZOOM = 0.184;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const knots = (ts: number[], vs: number[], t: number) => S.interpolate(t, ts, vs, clamped);
    const cameraScale = (t: number) => 1 + ZOOM * Math.exp(-Math.max(0, t) / TAU);
    const ROW1_T = [0, 0.322, 0.564, 0.964, 1.455, 1.964, 3.172, 3.497, 3.73, 4.005];
    const ROW1_V = [0, -69.7, -104.5, -144.2, -178.2, -204.5, -242.8, -248.9, -254.8, -258.8];
    const ROW3_T = [0, 0.164, 0.247, 0.322, 0.564, 0.805, 1.047, 1.405, 1.855, 2.447, 3.047, 3.364, 4.005];
    const ROW3_V = [0, 58.2, 93.6, 119.7, 175.8, 216.2, 247.4, 282.6, 314.5, 342.2, 357.9, 363, 365];
    const ROW_PHASE = [-118, 0, -142.3];
    const PAN_T = [0, 2.95, 3.014, 3.247, 3.447, 3.564, 3.73, 3.814, 3.93, 3.972, 4.005];
    const PAN_V = [0, 0, -1, -6.5, -16.5, -25.5, -43.4, -55.9, -82.4, -95.4, -113.4];
    const CLEARANCE = { left: [51, 57.3, 0.805], right: [65, 79.7, 0.91] };
    const PRESS_T = [1.622, 1.689, 1.764, 1.805, 1.897, 1.964, 2.047, 2.122, 2.205, 2.255, 2.33];
    const PRESS_V = [1, 0.969, 0.946, 0.931, 0.949, 0.958, 0.968, 0.977, 0.986, 0.995, 1];
    const FLIP_AT = 1.689;
    const CURSOR_T = [0, 0.164, 0.247, 0.322, 0.414, 0.489, 0.564, 0.722, 0.889, 0.93, 1.047, 1.164, 1.289, 1.405, 2.03, 2.089, 2.172, 2.255, 2.33, 2.414, 2.505, 2.605, 2.73, 2.897, 3.089, 3.289, 3.497, 3.689, 4.005];
    const CURSOR_X = [123, 117.8, 110.6, 106, 103.8, 102.3, 101.7, 101.3, 101.6, 101.6, 101.8, 102.5, 103.6, 103.7, 104.9, 107, 112.1, 121.1, 133, 143, 150.2, 158, 163.6, 168.8, 173, 175.4, 177.9, 178.4, 178.2];
    const CURSOR_Y = [89.5, 85.4, 76.1, 65.6, 56.6, 49.1, 43.2, 35.4, 30.2, 28.2, 22.2, 13.8, -0.2, -2.6, -2.6, 0.5, 5.8, 16.4, 29.6, 40.4, 48.3, 56.8, 62.7, 65.6, 72.9, 75.8, 77.6, 78.5, 78.7];
    const LAND_INSET = 18;
    const GRANT_AT = 70 / 30;
    const GRANT_STEP = 7 / 30;
    const TURNS = [[0, 3], [1, 5], [2, 4]];
    const ADVANCE: Record<string, number> = { ' ': 0.26, '-': 0.35, '.': 0.27, ',': 0.27, "'": 0.19, '!': 0.29, a: 0.541, b: 0.578, c: 0.512, d: 0.578, e: 0.541, f: 0.34, g: 0.578, h: 0.552, i: 0.24, j: 0.24, k: 0.512, l: 0.24, m: 0.827, n: 0.552, o: 0.571, p: 0.578, q: 0.578, r: 0.351, s: 0.501, t: 0.35, u: 0.552, v: 0.499, w: 0.753, x: 0.501, y: 0.499, z: 0.474, A: 0.665, B: 0.654, C: 0.677, D: 0.7, E: 0.6, F: 0.578, G: 0.72, H: 0.71, I: 0.273, J: 0.531, K: 0.644, L: 0.57, M: 0.872, N: 0.73, O: 0.747, P: 0.635, Q: 0.747, R: 0.635, S: 0.614, T: 0.601, U: 0.71, V: 0.665, W: 0.948, X: 0.632, Y: 0.619, Z: 0.601 };

    const pan = (t: number) => knots(PAN_T, PAN_V, t);
    const clearance = (side: 'left' | 'right', t: number) => CLEARANCE[side][0] + CLEARANCE[side][1] * Math.exp(-Math.max(0, t) / CLEARANCE[side][2]);
    const rowDrift = (row: number, t: number) => (row === 0 ? knots(ROW1_T, ROW1_V, t) : row === 2 ? knots(ROW3_T, ROW3_V, t) : 0);
    const labelWidth = (text: string) => {
      let em = 0;
      let spaces = 0;
      for (const ch of text) {
        em += ADVANCE[ch] ?? (/[0-9]/.test(ch) ? 0.6 : 0.55);
        if (ch === ' ') {
          spaces++;
        }
      }
      return em * PILL.label + spaces * PILL.wordSpacing;
    };
    const half = (PILL.padX * 2 + labelWidth(label.trim()) + PILL.iconGap + PILL.iconW) / 2;
    const slotRest = (row: number, slot: number) => {
      if (row !== 1) {
        return (ROW_PHASE[row] ?? 0) + slot * CARD_PITCH;
      }
      const edge = half + CARD.w / 2;
      return slot < 0 ? -(edge + CLEARANCE.left[0]) + (slot + 1) * CARD_PITCH : edge + CLEARANCE.right[0] + slot * CARD_PITCH;
    };
    const rowShift = (row: number, slot: number, t: number) => {
      if (row !== 1) {
        return rowDrift(row, t);
      }
      const side = slot < 0 ? 'left' : 'right';
      const open = clearance(side, t) - CLEARANCE[side][0];
      return side === 'left' ? -open : open;
    };
    const slotRange = (row: number) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let t = 0; t <= 4.2; t += 0.05) {
        const reach = REF_W / 2 / cameraScale(t) + CARD.w;
        lo = Math.min(lo, -pan(t) - reach);
        hi = Math.max(hi, -pan(t) + reach);
      }
      const out: number[] = [];
      for (let slot = -12; slot <= 12; slot++) {
        let seen = false;
        for (let t = 0; t <= 4.2 && !seen; t += 0.05) {
          const u = slotRest(row, slot) + rowShift(row, slot, t);
          if (u > lo && u < hi) {
            seen = true;
          }
        }
        if (seen) {
          out.push(slot);
        }
      }
      return out;
    };
    const grantSeed = (row: number, len: number, slots: number[]) => {
      const reach = REF_W / 2 / cameraScale(GRANT_AT);
      let left = -Infinity;
      let leftSlot: number | null = null;
      let near = Infinity;
      let nearSlot = 0;
      for (const slot of slots) {
        const u = slotRest(row, slot) + rowShift(row, slot, GRANT_AT);
        const disc = u - CARD.w / 2 + AVATAR.padX + AVATAR.size / 2;
        if (Math.abs(disc) > reach - AVATAR.size / 2) {
          continue;
        }
        if (disc <= 0 && disc > left) {
          left = disc;
          leftSlot = slot;
        }
        if (Math.abs(disc) < near) {
          near = Math.abs(disc);
          nearSlot = slot;
        }
      }
      const best = leftSlot ?? nearSlot;
      return ((best % len) + len) % len;
    };
    const turnOf = (row: number, step: number) => 6 * Math.floor(step / 2) + (TURNS[row % 3]?.[step % 2] ?? 0);
    const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
    const parseRow = (text: unknown) => String(text).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [name, role] = s.split('/').map((x) => x.trim());
      return { name: name ?? '', role: role ?? '' };
    });
    const rows = [parseRow(p.row1), parseRow(p.row2), parseRow(p.row3)];

    const edge = S.mixOklch(String(th.secondary), String(th.border), 0.55);
    const avatars: { el: HTMLElement; order: number }[] = [];
    const groups: { el: HTMLElement; row: number; side: number }[] = [];
    const layers: Node[] = [];
    rows.forEach((roster, row) => {
      if (roster.length === 0) {
        return;
      }
      const range = slotRange(row);
      const seed = grantSeed(row, roster.length, range);
      const y = ORIGIN.y + (row - 1) * ROW_PITCH - CARD.h / 2;
      const sides = row === 1 ? [-1, 1] : [0];
      for (const side of sides) {
        const slots = range.filter((n) => (row === 1 ? (side < 0 ? n < 0 : n >= 0) : true));
        if (slots.length === 0) {
          continue;
        }
        const cards = slots.map((slot) => {
          const i = ((slot % roster.length) + roster.length) % roster.length;
          const entry = roster[i];
          const avatar = S.h('div', { style: { position: 'absolute', left: AVATAR.padX, top: (CARD.h - AVATAR.size) / 2, width: AVATAR.size, height: AVATAR.size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: AVATAR.initials, fontWeight: 500, lineHeight: 1 } }, initialsOf(entry.name)) as HTMLElement;
          avatars.push({ el: avatar, order: turnOf(row, (((i - seed) % roster.length) + roster.length) % roster.length) });
          const text = (top: number, size: number, weight: number, color: string, value: string) => S.h('div', { style: { position: 'absolute', left: TEXT_X, top, right: 10, fontSize: size, fontWeight: weight, lineHeight: 1, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, value);
          return S.h('div', { style: { position: 'absolute', left: slotRest(row, slot) + ORIGIN.x - CARD.w / 2, top: y, width: CARD.w, height: CARD.h, borderRadius: CARD.radius, background: String(th.secondary), boxShadow: `inset 0 0 0 1px ${edge}`, overflow: 'hidden' } }, avatar, text(16.7, 20, 500, String(th.foreground), entry.name), text(43.3, 13, 400, String(th.mutedForeground), entry.role));
        });
        const el = S.h('div', { style: { position: 'absolute', inset: 0 } }, cards) as HTMLElement;
        groups.push({ el, row, side });
        layers.push(el);
      }
    });

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = (tag: string, attrs: Record<string, string | number>) => {
      const el = document.createElementNS(svgNs, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
      return el;
    };
    const icon = svg('svg', { width: PILL.iconW, height: PILL.iconH, viewBox: '0 0 24 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    ['M12 1.5v10.5', 'M7.5 7.5 12 12l4.5-4.5', 'M3.5 14.5v3a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-3'].forEach((d) => icon.appendChild(svg('path', { d })));
    const pill = S.h('div', { style: { position: 'absolute', left: ORIGIN.x, top: ORIGIN.y, width: 'max-content', height: PILL.h, padding: `0 ${PILL.padX}px`, boxSizing: 'border-box', borderRadius: PILL.radius, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: PILL.iconGap, fontSize: PILL.label, fontWeight: 500, wordSpacing: PILL.wordSpacing, lineHeight: 1, whiteSpace: 'nowrap' } }, S.h('span', null, label), icon) as HTMLElement;
    const pointer = svg('svg', { width: CURSOR.size, height: CURSOR.size, viewBox: '0 0 24 24' }) as SVGSVGElement;
    pointer.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    pointer.appendChild(svg('path', { d: 'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z', fill: String(th.foreground), stroke: String(th.background), 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));

    const camera = S.h('div', { style: { position: 'absolute', inset: 0, transformOrigin: `${ORIGIN.x}px ${ORIGIN.y}px` } }, layers, pill, pointer) as HTMLElement;
    const k = Math.min(view.width / REF_W, view.height / REF_H);
    const stage = S.h('div', { style: { position: 'absolute', left: (view.width - REF_W * k) / 2, top: (view.height - REF_H * k) / 2, width: REF_W, height: REF_H, transform: `scale(${k})`, transformOrigin: '0 0' } }, camera);
    const card = String(th.card);
    const backdrop = S.parseColor(String(th.background)).alpha !== 0 ? S.fill({ background: [`radial-gradient(58% 44% at 50% 46%, ${S.withAlpha(card, 0.9)} 0%, ${S.withAlpha(card, 0)} 100%)`, `radial-gradient(78% 62% at 64% 116%, ${S.withAlpha(accent, 0.42)} 0%, ${S.withAlpha(accent, 0)} 100%)`, `radial-gradient(52% 46% at -4% -8%, ${S.withAlpha(accent, 0.16)} 0%, ${S.withAlpha(accent, 0)} 100%)`, String(th.background)].join(', ') }) : null;
    view.root.replaceChildren(S.fill({ background: String(th.background), fontFamily: face, textRendering: 'geometricPrecision', fontOpticalSizing: 'none', overflow: 'hidden', display: 'block' }, backdrop, stage));

    return (frame) => {
      const t = (frame * speed) / view.fps;
      const cam = cameraScale(t);
      camera.style.transform = `translateX(${pan(t) * cam}px) scale(${cam})`;
      groups.forEach((g) => {
        g.el.style.transform = `translateX(${rowShift(g.row, g.side, t)}px)`;
      });
      avatars.forEach((a) => {
        const on = t + 1e-6 >= GRANT_AT + GRANT_STEP * a.order;
        a.el.style.background = on ? accent : card;
        a.el.style.color = String(on ? th.primaryForeground : th.foreground);
      });
      const on = t >= FLIP_AT;
      const fillColor = on ? accent : String(th.foreground);
      pill.style.transform = `translate(-50%, -50%) scale(${knots(PRESS_T, PRESS_V, t)})`;
      pill.style.background = fillColor;
      pill.style.color = String(on ? th.primaryForeground : th.background);
      pill.style.boxShadow = `inset 0 1px 0 ${S.withAlpha('#ffffff', 0.22)}, 0 10px 26px -6px ${S.withAlpha(fillColor, 0.34)}`;
      const x = knots(CURSOR_T, CURSOR_X, t);
      const yy = knots(CURSOR_T, CURSOR_Y, t);
      const over = Math.min(1, Math.max(0, (PILL.h * 1.5 - Math.abs(yy)) / PILL.h));
      const px = x - Math.max(0, x - (half - LAND_INSET)) * over;
      pointer.style.transform = `translate(${ORIGIN.x + px - CURSOR.tip.x * (CURSOR.size / 24)}px, ${ORIGIN.y + yy - CURSOR.tip.y * (CURSOR.size / 24)}px)`;
    };
  }
};
