import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'button-press',
  title: 'Button press',
  about: 'A cursor clicks a split action button: it darkens, gives, spins while it works and lands on a tick.',
  category: SnapcnCategory.Cursor,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 126,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    label: { type: 'string', title: 'Idle label', default: 'Deploy', group: 'Content', maxLength: 40 },
    pending: { type: 'string', title: 'Pending label', default: 'Deploying…', group: 'Content', maxLength: 40 },
    done: { type: 'string', title: 'Done label', default: 'Deployed', group: 'Content', maxLength: 40 },
    width: { type: 'number', title: 'Button width at 720p (px)', default: 320, minimum: 120, maximum: 1000, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    primary: { type: 'string', title: 'Button (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const speed = Number(p.speed);
    const s = view.height / 720;
    const primary = S.pick(p.primary, String(t.primary));
    const fg = String(t.primaryForeground);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const CLICK_AT = 36;
    const PENDING_FRAMES = 40;
    const H = 76 * s;
    const W = Number(p.width) * s;
    const CHEVRON = H * 0.86;
    const doneAt = CLICK_AT + PENDING_FRAMES;

    const phase = (frame: number, from: number, to?: number) => {
      const inP = S.interpolate(frame, [from, from + 8], [0, 1], { ...clamped, easing: EASE });
      const outP = to === undefined ? 0 : S.interpolate(frame, [to, to + 8], [0, 1], { ...clamped, easing: EASE });
      return { opacity: inP * (1 - outP), y: (1 - inP) * 14 - outP * 14 };
    };

    const icon = 26 * s;
    const svg = (inner: string, style = '') => {
      const el = document.createElement('span');
      el.style.display = 'contents';
      el.innerHTML = `<svg viewBox="0 0 24 24" width="${icon}" height="${icon}" style="${style}">${inner}</svg>`;
      return el.firstElementChild as SVGElement;
    };
    const spinner = svg(`<circle cx="12" cy="12" r="9" fill="none" stroke="${fg}" stroke-opacity="0.3" stroke-width="2.6"/><path d="M12 3 A9 9 0 0 1 21 12" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linecap="round"/>`);
    const tickSvg = svg(`<path d="M5 12.5 L10 17 L19 7.5" fill="none" stroke="${fg}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`);
    const tickPath = tickSvg.firstElementChild as SVGPathElement;
    const row = (...children: (Node | string)[]) => S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 * s } }, ...children) as HTMLElement;
    const rows = [row(String(p.label)), row(spinner, String(p.pending)), row(tickSvg, String(p.done))];

    const surface = S.h('div', { style: { position: 'absolute', inset: 0, borderRadius: t.radius * (H / 36) } }) as HTMLElement;
    const chevronBox = H * 0.34;
    const chevron = document.createElement('span');
    chevron.style.display = 'contents';
    chevron.innerHTML = `<svg viewBox="0 0 24 24" width="${chevronBox}" height="${chevronBox}" style="position:absolute;right:${(CHEVRON - chevronBox) / 2}px;top:${H * 0.33}px"><path d="M6 9.5 L12 15.5 L18 9.5" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const button = S.h(
      'div',
      { style: { position: 'relative', width: W, height: H, color: fg, whiteSpace: 'nowrap' } },
      surface,
      S.h('div', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, right: CHEVRON, overflow: 'hidden' } }, rows),
      S.h('div', { style: { position: 'absolute', right: CHEVRON, top: H * 0.24, bottom: H * 0.24, width: Math.max(1, H / 76), backgroundColor: S.withAlpha(fg, 0.32) } }),
      chevron.firstElementChild
    );
    const wrap = S.h('div', { style: { fontSize: 28 * s, letterSpacing: '-0.01em' } }, button) as HTMLElement;
    const face = S.pick(p.fontFamily, 'Inter');

    const ch = view.height * 0.039;
    const ink = String(t.foreground);
    const outline = String(t.background);
    const ring = String(t.primary);
    const CURSOR_EASE = S.Easing.inOut(S.Easing.cubic);
    const RING_EASE = S.Easing.out(S.Easing.cubic);
    const CLICK_FRAMES = 14;
    const path = [
      { at: 8, x: 0.86, y: 1.08, duration: 6, click: false },
      { at: 14, x: 0.47, y: 0.53, duration: CLICK_AT - 14, click: true },
      { at: doneAt + 14, x: 0.62, y: 0.7, duration: 18, click: false }
    ];
    const pose = (frame: number) => {
      const first = path[0];
      const opacity = S.interpolate(frame, [first.at, first.at + first.duration], [0, 1], { ...clamped, easing: RING_EASE });
      let x = first.x;
      let y = first.y;
      for (let i = 1; i < path.length; i++) {
        const m = path[i];
        if (frame < m.at) {
          break;
        }
        const until = i + 1 < path.length ? Math.min(frame, path[i + 1].at) : frame;
        const k = S.interpolate(until, [m.at, m.at + m.duration], [0, 1], { ...clamped, easing: CURSOR_EASE });
        x += (m.x - x) * k;
        y += (m.y - y) * k;
      }
      let click = 0;
      for (const m of path) {
        const end = m.at + m.duration;
        if (m.click && frame >= end && frame < end + CLICK_FRAMES) {
          click = (frame - end + 1) / CLICK_FRAMES;
        }
      }
      return { x, y, click, opacity };
    };
    const ringEl = S.h('div', { style: { position: 'absolute', borderRadius: '50%', border: `${Math.max(1.5, ch * 0.07)}px solid ${ring}`, backgroundColor: S.withAlpha(ring, 0.12) } }) as HTMLElement;
    const box = (ch * 24) / 14;
    const tip = (ch * 5.5) / 14;
    const arrowPath = 'M5.5 5.5 19 11l-5.6 1.45a2 2 0 0 0-1.45 1.45L10.5 19.5z';
    const pointer = document.createElement('div');
    pointer.innerHTML = `<svg viewBox="0 0 24 24" width="${box}" height="${box}" style="position:absolute;left:${-tip}px;top:${-tip}px;display:block;overflow:visible"><defs><filter id="bp-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-opacity="0.35"/></filter></defs><g filter="url(#bp-shadow)"><path d="${arrowPath}" fill="${outline}" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/><path d="${arrowPath}" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
    const mover = S.h('div', { style: { position: 'absolute', left: 0, top: 0 } }, ringEl, pointer) as HTMLElement;

    view.root.replaceChildren(
      S.fill({ backgroundColor: String(t.background), alignItems: 'center', justifyContent: 'center', fontFamily: face, fontWeight: 500, fontOpticalSizing: 'none', textRendering: 'geometricPrecision' }, wrap),
      S.fill({ background: 'transparent', pointerEvents: 'none' }, mover)
    );

    return (at) => {
      const frame = at * speed;
      const enter = S.interpolate(frame, [0, 14], [0, 1], { ...clamped, easing: EASE });
      const hover = S.interpolate(frame, [CLICK_AT - 6, CLICK_AT], [0, 1], clamped);
      const pressP = S.interpolate(frame, [CLICK_AT, CLICK_AT + 10], [0, 1], clamped);
      wrap.style.opacity = String(enter);
      wrap.style.transform = `translateY(${(1 - enter) * 12 * s}px)`;
      surface.style.backgroundColor = S.mixOklch(primary, String(t.foreground), hover * 0.14);
      surface.style.scale = String(1 - Math.sin(pressP * Math.PI) * 0.035);

      [phase(frame, -8, CLICK_AT + 2), phase(frame, CLICK_AT + 2, doneAt), phase(frame, doneAt)].forEach((ph, i) => {
        rows[i].style.opacity = String(ph.opacity);
        rows[i].style.transform = `translateY(${ph.y * s}px)`;
      });
      spinner.style.rotate = `${frame * 12}deg`;
      tickPath.setAttribute('stroke-dashoffset', String(1 - S.interpolate(frame, [doneAt + 4, doneAt + 14], [0, 1], { ...clamped, easing: EASE })));

      const now = pose(frame);
      mover.style.display = now.opacity <= 0 ? 'none' : 'block';
      mover.style.opacity = String(now.opacity);
      mover.style.transform = `translate(${now.x * view.width}px, ${now.y * view.height}px)`;
      const r = S.interpolate(now.click, [0, 1], [ch * 0.18, ch * 1.1], { ...clamped, easing: RING_EASE });
      ringEl.style.display = now.click > 0 ? 'block' : 'none';
      ringEl.style.left = `${-r}px`;
      ringEl.style.top = `${-r}px`;
      ringEl.style.width = `${r * 2}px`;
      ringEl.style.height = `${r * 2}px`;
      ringEl.style.opacity = String(1 - now.click);
    };
  }
};
