import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'cursor-track',
  title: 'Cursor track',
  about: 'A pointer walks in from off-frame, clicks twice with a ring pulse, then drifts off to the top right.',
  category: SnapcnCategory.Cursor,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: [],
  props: {
    variant: { type: 'string', title: 'Cursor', enum: ['arrow', 'dot'], default: 'arrow', group: 'Style' },
    size: { type: 'number', title: 'Cursor height (px, 0 = auto)', default: 0, minimum: 0, maximum: 200, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Fill (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    outlineColor: { type: 'string', title: 'Outline (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    ringColor: { type: 'string', title: 'Click ring (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    clickFrames: { type: 'number', title: 'Click ring (frames)', default: 14, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    showBefore: { type: 'boolean', title: 'Show before first move', default: false, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const speed = Number(p.speed);
    const clickFrames = Number(p.clickFrames);
    const h = Number(p.size) > 0 ? Number(p.size) : view.height * 0.039;
    const ink = S.pick(p.color, String(t.foreground));
    const outline = S.pick(p.outlineColor, String(t.background));
    const ring = S.pick(p.ringColor, String(t.primary));
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CURSOR_EASE = S.Easing.inOut(S.Easing.cubic);
    const RING_EASE = S.Easing.out(S.Easing.cubic);
    const TRAVEL = 14;
    const path = [
      { at: 0, x: -0.06, y: 0.86, duration: 6, click: false },
      { at: 8, x: 0.34, y: 0.44, duration: 22, click: true },
      { at: 52, x: 0.68, y: 0.62, duration: 20, click: true },
      { at: 96, x: 0.82, y: 0.28, duration: 18, click: false }
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
        const k = S.interpolate(until, [m.at, m.at + (m.duration ?? TRAVEL)], [0, 1], { ...clamped, easing: CURSOR_EASE });
        x += (m.x - x) * k;
        y += (m.y - y) * k;
      }
      let click = 0;
      for (const m of path) {
        const at = m.at + m.duration;
        if (m.click && clickFrames > 0 && frame >= at && frame < at + clickFrames) {
          click = (frame - at + 1) / clickFrames;
        }
      }
      return { x, y, click, opacity };
    };

    const ringEl = S.h('div', { style: { position: 'absolute', borderRadius: '50%', border: `${Math.max(1.5, h * 0.07)}px solid ${ring}`, backgroundColor: S.withAlpha(ring, 0.12) } }) as HTMLElement;
    const d = h * 0.62;
    const box = (h * 24) / 14;
    const tip = (h * 5.5) / 14;
    const arrowPath = 'M5.5 5.5 19 11l-5.6 1.45a2 2 0 0 0-1.45 1.45L10.5 19.5z';
    const pointer = document.createElement('div');
    if (p.variant === 'dot') {
      pointer.style.cssText = `position:absolute;left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;border-radius:50%;background-color:${S.withAlpha(ink, 0.42)};border:${Math.max(1.5, h * 0.05)}px solid ${outline}`;
    } else {
      pointer.innerHTML = `<svg viewBox="0 0 24 24" width="${box}" height="${box}" style="position:absolute;left:${-tip}px;top:${-tip}px;display:block;overflow:visible"><defs><filter id="ct-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-opacity="0.35"/></filter></defs><g filter="url(#ct-shadow)"><path d="${arrowPath}" fill="${outline}" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/><path d="${arrowPath}" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
    }
    const mover = S.h('div', { style: { position: 'absolute', left: 0, top: 0 } }, ringEl, pointer) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent', pointerEvents: 'none' }, mover));

    return (at) => {
      const now = pose(at * speed);
      const opacity = p.showBefore === true ? 1 : now.opacity;
      mover.style.display = opacity <= 0 ? 'none' : 'block';
      mover.style.opacity = String(opacity);
      mover.style.transform = `translate(${now.x * view.width}px, ${now.y * view.height}px)`;
      const r = S.interpolate(now.click, [0, 1], [h * 0.18, h * 1.1], { ...clamped, easing: RING_EASE });
      ringEl.style.display = now.click > 0 ? 'block' : 'none';
      ringEl.style.left = `${-r}px`;
      ringEl.style.top = `${-r}px`;
      ringEl.style.width = `${r * 2}px`;
      ringEl.style.height = `${r * 2}px`;
      ringEl.style.opacity = String(1 - now.click);
    };
  }
};
