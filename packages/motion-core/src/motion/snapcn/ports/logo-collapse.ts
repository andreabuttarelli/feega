import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'logo-collapse',
  title: 'Logo collapse',
  about: 'A stack of shots cuts smaller and faster, collapses into the mark, and the wordmark lands beside it.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 52,
  background: '#faf9f6',
  fonts: ['Inter Tight'],
  props: {
    images: { type: 'string', title: 'Images', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    sizes: { type: 'string', title: 'Card sizes (share of height, WxH)', default: '0.82x0.461,0.72x0.405,0.63x0.354,0.55x0.309,0.46x0.259,0.36x0.203', group: 'Content', maxLength: 400 },
    holds: { type: 'string', title: 'Frames per shot', default: '1,5,5,4,2,5', group: 'Motion', maxLength: 200 },
    mark: { type: 'string', title: 'Mark', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    wordmark: { type: 'string', title: 'Wordmark', default: 'feega', group: 'Content', maxLength: 60 },
    plate: { type: 'string', title: 'Backdrop', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    accent: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 592;
    const REF_H = 336;
    const STAGE_X = 294;
    const STAGE_Y = 167.5;
    const MARK = 22;
    const LAND = [32, 25, 24, 24];
    const TILE = 60;
    const TILE_FRAMES = 2;
    const LOCK_X = 237;
    const WORD_X = 264;
    const WORD_CAP = 19.37;
    const WORD_TOP = 155.74;
    const WORD_EM = 1.326;
    const WORD_TRACK = -0.073;
    const STEP_X = 281.5;
    const STEP_AT = 28;
    const WORD_AT = 30;
    const DOT_AT = [37, 42];
    const DOTS = [[229, 147], [229, 191]];
    const DOT_IN = 7;
    const DOT_OUT = 4;
    const DOT_SETTLE = 5;
    const DOT_FADE = 0.34;

    const svg = (markup: string) => 'data:image/svg+xml,' + encodeURIComponent(markup);
    const sample = (hue: number) => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,60%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},55%,25%)"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>`);
    const given = S.media(p.images);
    const shots = given.length ? given : [20, 70, 140, 200, 260, 320].map(sample);
    const mark = String(p.mark) || svg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="8" y="8" width="84" height="84" rx="20" fill="#f26b1d"/></svg>');
    const size = String(p.sizes).split(',').map((s) => {
      const [w, hh] = s.trim().split('x');
      const sw = Number(w);
      return [sw, hh === undefined ? sw : Number(hh)];
    });
    const hold = String(p.holds).split(',').map((s) => Number(s.trim()));
    const accent = S.pick(p.accent, String(t.primary));
    const face = S.pick(p.fontFamily, 'Inter Tight');

    const u = view.height / REF_H;
    const ox = (view.width - REF_W * u) / 2;
    const box = (w: number, hh: number, cx: number, cy: number) => ({ position: 'absolute', left: (cx - w / 2) * u, top: (cy - hh / 2) * u, width: w * u, height: hh * u, objectFit: 'cover', maxWidth: 'none' });
    const img = (src: string, style: Record<string, string | number>) => S.h('img', { src, alt: '', style });

    const stage = S.h('div', { style: { position: 'absolute', left: ox, top: 0, width: REF_W * u, height: REF_H * u, fontFamily: face, textRendering: 'geometricPrecision' } });
    const plate = String(p.plate) ? img(String(p.plate), { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none' }) : null;
    view.root.replaceChildren(S.fill({ backgroundColor: String(t.background) }, plate, stage));

    const collapseAt = hold.slice(0, shots.length).reduce((a, b) => a + (b || 0), 0);
    const shotAt = (frame: number) => {
      let at = 0;
      for (let i = 0; i < shots.length; i++) {
        const end = at + (hold[i] ?? 0);
        if (frame < end) {
          return i;
        }
        at = end;
      }
      return -1;
    };

    const lockup = (frame: number) => {
      const since = frame - collapseAt;
      const sz = LAND[since] ?? MARK;
      const worded = frame >= WORD_AT;
      const cx = worded ? LOCK_X + MARK / 2 : frame >= STEP_AT ? STEP_X : STAGE_X;
      const parts: Element[] = [];
      if (since < TILE_FRAMES) {
        parts.push(S.h('div', { style: { ...box(TILE, TILE, STAGE_X, STAGE_Y), background: String(t.muted) } }));
      }
      parts.push(img(mark, box(sz, sz, cx, STAGE_Y)));
      if (worded) {
        parts.push(S.h('div', { style: { position: 'absolute', left: WORD_X * u, top: WORD_TOP * u, fontSize: WORD_CAP * WORD_EM * u, lineHeight: 1, fontWeight: 700, letterSpacing: `${WORD_TRACK}em`, color: String(t.foreground), whiteSpace: 'nowrap' } }, String(p.wordmark)));
      }
      DOTS.forEach(([dx, dy], i) => {
        const s = frame - (DOT_AT[i] ?? Infinity);
        if (s < 0) {
          return;
        }
        const k = Math.min(1, s / DOT_SETTLE);
        const d = DOT_IN + (DOT_OUT - DOT_IN) * k;
        parts.push(S.h('div', { style: { position: 'absolute', left: (dx - d / 2) * u, top: (dy - d / 2) * u, width: d * u, height: d * u, background: accent, opacity: 1 + (DOT_FADE - 1) * k } }));
      });
      return parts;
    };

    return (frame) => {
      const shot = shotAt(frame);
      if (shot >= 0) {
        stage.replaceChildren(img(shots[shot] ?? '', box((size[shot]?.[0] ?? 0.4) * REF_H, (size[shot]?.[1] ?? 0.4) * REF_H, STAGE_X, STAGE_Y)));
        return;
      }
      stage.replaceChildren(...lockup(frame));
    };
  }
};
