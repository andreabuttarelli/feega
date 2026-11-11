import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'neon-sign',
  title: 'Neon sign',
  about: 'A handwritten neon sign flickers on tube by tube, buzzes once, then settles into a steady glow.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 70,
  background: '#111111',
  fonts: [],
  props: {
    strokeWidth: { type: 'number', title: 'Tube width', default: 6, minimum: 2, maximum: 14, step: 1, group: 'Style' },
    fit: { type: 'number', title: 'Fit', default: 0.62, minimum: 0.3, maximum: 0.9, step: 0.01, group: 'Style' },
    color: { type: 'string', title: 'Tube', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    glowColor: { type: 'string', title: 'Glow', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    tubeColor: { type: 'string', title: 'Unlit tube', format: PropFormat.Color, default: '#2A2A2A', group: 'Style' },
    coreColor: { type: 'string', title: 'Core', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 7, minimum: 1, maximum: 99, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const strokeWidth = Number(p.strokeWidth);
    const fit = Number(p.fit);
    const seed = Number(p.seed);
    const NS = 'http://www.w3.org/2000/svg';
    const FIRST = 3;
    const STEP = 3.4;
    const STUTTER = 7;
    const BUZZ: Record<number, number> = { 29: 0.1, 30: 0, 31: 0.55, 32: 0.2 };
    const SETTLE_FROM = 0.85;
    const GLOW_ALPHA = 0.28;
    const HEIGHT_SHARE = 0.7;
    const BOX_PAD = 6;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const PATH = [
      'M 30 132 C 52 112 74 70 70 46 C 67 28 50 30 47 52 C 44 76 42 112 40 140 C 46 116 58 100 72 100 C 86 100 84 122 86 134 C 88 144 100 144 110 132',
      'M 110 132 C 124 124 142 110 136 98 C 130 88 112 96 112 116 C 112 138 134 146 156 130',
      'M 156 130 C 176 110 196 66 190 46 C 186 32 170 36 168 60 C 166 90 168 126 172 136 C 176 146 188 142 196 132',
      'M 196 132 C 216 110 232 66 226 46 C 222 32 206 36 204 60 C 202 90 204 126 208 136 C 212 146 224 142 232 132',
      'M 232 132 C 238 116 248 100 262 100 C 278 100 280 124 268 136 C 256 146 242 136 248 118 C 252 106 268 104 290 104',
      'M 52 170 C 120 160 210 162 296 152'
    ];

    const coords = PATH.join(' ').match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    const pad = strokeWidth * BOX_PAD;
    const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    const scale = Math.min((view.width * fit) / box.w, (view.height * HEIGHT_SHARE) / box.h);
    const drawW = box.w * scale;
    const drawH = box.h * scale;

    const blurFilter = (id: string, deviation: number) => {
      const filter = document.createElementNS(NS, 'filter');
      filter.setAttribute('id', id);
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('x', String(box.x - box.w));
      filter.setAttribute('y', String(box.y - box.h));
      filter.setAttribute('width', String(box.w * 3));
      filter.setAttribute('height', String(box.h * 3));
      const blur = document.createElementNS(NS, 'feGaussianBlur');
      blur.setAttribute('stdDeviation', String(deviation));
      filter.appendChild(blur);
      return filter;
    };

    const stroke = (d: string, color: string, width: number, filter?: string) => S.h('path', { d, stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter }) as SVGElement;
    const lit = PATH.map((d) => ({
      wide: stroke(d, String(p.glowColor), strokeWidth * 3, 'url(#neon-sign-wide)'),
      near: stroke(d, String(p.color), strokeWidth * 1.6, 'url(#neon-sign-near)'),
      tube: stroke(d, String(p.color), strokeWidth),
      core: stroke(d, String(p.coreColor), strokeWidth * 0.36)
    }));
    const groups = lit.map((parts) => S.h('g', null, parts.wide, parts.near, parts.tube, parts.core) as SVGElement);
    const unlit = PATH.map((d) => stroke(d, String(p.tubeColor), strokeWidth));
    const defs = S.h('defs', null) as SVGElement;
    defs.appendChild(blurFilter('neon-sign-wide', strokeWidth * 2.2));
    defs.appendChild(blurFilter('neon-sign-near', strokeWidth * 0.6));
    const svg = S.h('svg', { width: drawW, height: drawH, viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, style: { overflow: 'visible' } }, defs, unlit, groups);
    const halo = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse ${drawW * 0.75}px ${drawH * 0.85}px at 50% 50%, ${String(p.glowColor)} 0%, transparent 100%)` } }) as HTMLElement;
    view.root.replaceChildren(halo, S.fill({ alignItems: 'center', justifyContent: 'center' }, svg));

    const levelOf = (t: number, i: number) => {
      const onset = FIRST + i * STEP + S.random(`neon-sign-${seed}-${i}`) * 2;
      if (t < onset) {
        return 0;
      }
      if (t >= onset + STUTTER) {
        return 1;
      }
      const v = S.random(`neon-sign-${seed}-${i}-${Math.floor(t)}`);
      const ramp = (t - onset) / STUTTER;
      return v < 0.5 - ramp * 0.3 ? 0.04 : 0.55 + 0.45 * v;
    };

    return (t) => {
      const buzz = BUZZ[Math.floor(t)] ?? 1;
      const levels = PATH.map((_, i) => levelOf(t, i) * buzz);
      const average = levels.reduce((a, b) => a + b, 0) / levels.length;

      halo.style.opacity = String(GLOW_ALPHA * average * S.interpolate(t, [32, 40], [SETTLE_FROM, 1], clamped));
      groups.forEach((group, i) => {
        const level = levels[i];
        group.style.display = level <= 0 ? 'none' : '';
        lit[i].wide.setAttribute('opacity', String(0.7 * level));
        lit[i].near.setAttribute('opacity', String(0.9 * level));
        lit[i].tube.setAttribute('opacity', String(level));
        lit[i].core.setAttribute('opacity', String(0.9 * level));
      });
    };
  }
};
