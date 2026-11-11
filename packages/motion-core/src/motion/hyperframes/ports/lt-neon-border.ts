import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'lt-neon-border',
  title: 'Lower third, neon border',
  about: 'A dark panel framed by two glowing light arcs that race around its border while the name and role rise in.',
  category: HfCategory.LowerThird,
  origin: HfOrigin.Block,
  source: 'lt-neon-border',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 144,
  background: '#0f1115',
  fonts: ['Inter'],
  props: {
    person: { type: 'string', title: 'Name', default: 'Dr. Maya Chen', group: 'Content', maxLength: 60 },
    role: { type: 'string', title: 'Role', default: 'Host · Neuroscientist', group: 'Content', maxLength: 80 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#cc9149', group: 'Style' },
    movement: { type: 'string', title: 'Movement', enum: ['step', 'glide'], default: 'step', group: 'Motion' },
    speed: { type: 'number', title: 'Speed (corners/s)', default: 1.6, minimum: 0.2, maximum: 6, step: 0.1, group: 'Motion' },
    cornerRadius: { type: 'number', title: 'Corner radius', default: 26, minimum: 0, maximum: 90, step: 1, group: 'Style' },
    thickness: { type: 'number', title: 'Thickness', default: 5, minimum: 1, maximum: 16, step: 1, group: 'Style' },
    arcLength: { type: 'number', title: 'Arc length (%)', default: 22, minimum: 5, maximum: 100, step: 1, group: 'Style' },
    glow: { type: 'number', title: 'Glow', default: 1, minimum: 0, maximum: 2, step: 0.05, group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 820;
    const H = 210;
    const DUR = 4.8;
    const num = (v: unknown, fallback: number) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isFinite(n) ? n : fallback;
    };
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(p.accent)) ? String(p.accent) : '#cc9149';
    const glide = p.movement === 'glide';
    const speed = Math.max(0.05, num(p.speed, 1.6));
    const r = Math.min(Math.min(W, H) / 2, Math.max(0, num(p.cornerRadius, 26)));
    const thickness = Math.max(0.5, num(p.thickness, 5));
    const arcFrac = Math.min(1, Math.max(0.02, num(p.arcLength, 22) / 100));
    const glow = Math.max(0, num(p.glow, 1));

    const towardWhite = (hex: string, amount: number) => {
      const v = parseInt(hex.slice(1), 16);
      let out = '#';
      for (let s = 16; s >= 0; s -= 8) {
        const c = (v >> s) & 255;
        const m = Math.round(c + (255 - c) * amount);
        out += '0123456789abcdef'.charAt(m >> 4) + '0123456789abcdef'.charAt(m & 15);
      }
      return out;
    };
    const hot = towardWhite(accent, 0.78);

    const arc = 'A ' + r + ' ' + r + ' 0 0 1 ';
    const d = ['M ' + r + ' 0', 'H ' + (W - r), arc + W + ' ' + r, 'V ' + (H - r), arc + (W - r) + ' ' + H, 'H ' + r, arc + '0 ' + (H - r), 'V ' + r, arc + r + ' 0', 'Z'].join(' ');

    const SW = W - 2 * r;
    const SH = H - 2 * r;
    const AC = (Math.PI * r) / 2;
    const P = 2 * SW + 2 * SH + 4 * AC;
    const CORNERS = [SW + AC / 2, SW + SH + 1.5 * AC, 2 * SW + SH + 2.5 * AC, 2 * SW + 2 * SH + 3.5 * AC];
    const cornerPos = (k: number) => {
      const lap = Math.floor(k / 4);
      return CORNERS[k - lap * 4] + lap * P;
    };

    const bezier = (x1: number, y1: number, x2: number, y2: number) => {
      const axis = (t: number, a: number, b: number) => {
        const u = 1 - t;
        return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
      };
      return (x: number) => {
        if (x <= 0) {
          return 0;
        }
        if (x >= 1) {
          return 1;
        }
        let lo = 0;
        let hi = 1;
        let t = x;
        for (let i = 0; i < 32; i++) {
          t = (lo + hi) / 2;
          if (axis(t, x1, x2) < x) {
            lo = t;
          } else {
            hi = t;
          }
        }
        return axis(t, y1, y2);
      };
    };
    const ease = glide ? bezier(0.65, 0, 0.35, 1) : bezier(0.72, 0.16, 0.18, 1.05);
    const beat = 1 / speed;
    const headAt = (t: number) => {
      const total = t / beat;
      const k = Math.floor(total);
      const a = cornerPos(k);
      return a + (cornerPos(k + 1) - a) * ease(total - k);
    };

    const buildSegments = (count: number, falloff: number) => {
      const segs: Element[] = [];
      const nodes: Element[] = [];
      for (let i = 0; i < count; i++) {
        const seg = S.h('path', { d, fill: 'none', 'stroke-linecap': i === 0 ? 'round' : 'butt', opacity: String(Math.pow(1 - i / count, falloff)) });
        segs.push(seg);
        nodes.push(seg);
      }
      return { segs, nodes };
    };
    const GLOW_SEGS = 20;
    const CORE_SEGS = 26;
    const glowLen = arcFrac * P;
    const coreLen = 0.34 * glowLen;
    const arcs = [0, 2].map((offset) => ({ offset, glow: buildSegments(GLOW_SEGS, 2.6), core: buildSegments(CORE_SEGS, 1.4) }));
    const defs = S.h('defs', null, ...arcs.flatMap((a, i) => [S.h('g', { id: 'nb-seg-' + i + '-glow' }, ...a.glow.nodes), S.h('g', { id: 'nb-seg-' + i + '-core' }, ...a.core.nodes)]));

    const MAX_REACH = 36;
    const LAYERS = [
      { blur: 30, spread: 1, opacity: 0.18, stroke: accent, deep: true, core: false },
      { blur: 15, spread: 0.6, opacity: 0.3, stroke: accent, deep: true, core: false },
      { blur: 8, spread: 0.3, opacity: 0.5, stroke: accent, deep: true, core: false },
      { blur: 4, spread: 0.05, opacity: 0.9, stroke: hot, deep: false, core: true },
      { blur: 0, spread: -0.012, opacity: 1, stroke: '#ffffff', deep: false, core: true }
    ];
    const under: Element[] = [];
    const over: Element[] = [];
    arcs.forEach((_, i) => {
      LAYERS.forEach((layer) => {
        const use = S.h('use', {
          href: '#nb-seg-' + i + '-' + (layer.core ? 'core' : 'glow'),
          stroke: layer.stroke,
          'stroke-width': String(Math.max(0.5, thickness + 2 * layer.spread * MAX_REACH * glow)),
          opacity: String(Math.min(1, layer.opacity * glow)),
          style: layer.blur > 0 ? { filter: 'blur(' + layer.blur + 'px)' } : undefined
        });
        (layer.deep ? under : over).push(use);
      });
    });

    const fillEl = S.h('path', { d, fill: 'rgba(9,11,15,0.78)' });
    const rail = S.h('path', { d, fill: 'none', stroke: accent, 'stroke-width': String(thickness), 'stroke-opacity': '0.14', 'stroke-linejoin': 'round' });
    const svg = S.h('svg', { width: 1120, height: 510, viewBox: '0 0 1120 510', fill: 'none', style: { position: 'absolute', inset: 0, display: 'block' } }, defs, S.h('g', { transform: 'translate(150,150)' }, S.h('g', null, ...under), fillEl, rail, S.h('g', null, ...over)));

    const who = S.h('span', { style: { display: 'block', fontSize: 54, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.015em', whiteSpace: 'nowrap', textShadow: '0 2px 20px rgba(0, 0, 0, 0.75)' } }, String(p.person)) as HTMLElement;
    const role = S.h('span', { style: { display: 'block', fontSize: 25, fontWeight: 400, color: '#d5dae3', lineHeight: 1.2, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: '0 2px 16px rgba(0, 0, 0, 0.75)' } }, String(p.role)) as HTMLElement;
    const panel = S.h('div', { style: { position: 'absolute', left: 150, top: 150, width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '0 52px' } }, who, role) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 50, bottom: 56, width: 1120, height: 510, fontFamily: 'Inter, sans-serif' } }, svg, panel) as HTMLElement;
    view.root.replaceChildren(wrap);

    const layout = (segs: Element[], head: number, length: number) => {
      const step = length / segs.length;
      segs.forEach((seg, i) => {
        const start = (((head - (i + 1) * step) % P) + P) % P;
        seg.setAttribute('stroke-dasharray', step + ' ' + (P - step));
        seg.setAttribute('stroke-dashoffset', String(-start));
      });
    };
    const paint = (t: number) => {
      arcs.forEach((a) => {
        const head = headAt(t + a.offset * beat);
        layout(a.glow.segs, head, glowLen);
        layout(a.core.segs, head, coreLen);
      });
    };

    const tl = S.timeline();
    const driver = { t: 0 };
    tl.set(wrap, { opacity: 0, scale: 0.965, transformOrigin: '0% 100%' }, 0);
    tl.set(who, { y: 18, opacity: 0 }, 0);
    tl.set(role, { y: 12, opacity: 0 }, 0);
    tl.to(driver, { t: DUR, duration: DUR, ease: 'none', onUpdate: () => paint(driver.t) }, 0);
    tl.to(wrap, { opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out' }, 0.08);
    tl.to(who, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.3);
    tl.to(role, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.44);
    tl.to(role, { y: -10, opacity: 0, duration: 0.3, ease: 'power2.in' }, 4.24);
    tl.to(who, { y: -14, opacity: 0, duration: 0.32, ease: 'power2.in' }, 4.3);
    tl.to(wrap, { opacity: 0, scale: 0.985, duration: 0.36, ease: 'power2.in' }, 4.36);
    tl.set(panel, { visibility: 'hidden' }, 4.76);
    paint(0);

    return (frame) => tl.render(frame / view.fps);
  }
};
