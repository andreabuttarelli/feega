import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'type-wall',
  title: 'Type wall',
  about: 'A wall of huge rows of repeating type slides in from the centre, each row drifting its own way around an accent band.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#2b3bff',
  fonts: ['Inter', 'Anton'],
  props: {
    text: { type: 'string', title: 'Text', default: 'MOTION', group: 'Content', maxLength: 40 },
    separator: { type: 'string', title: 'Separator', default: '·', group: 'Content', maxLength: 8 },
    fontSize: { type: 'number', title: 'Row height', default: 64, minimum: 24, maximum: 180, step: 2, group: 'Style' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    accent: { type: 'string', title: 'Band colour', format: PropFormat.Color, default: '#ff4d1a', group: 'Style' },
    accentText: { type: 'string', title: 'Band text', format: PropFormat.Color, default: '#111111', group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 7, minimum: 0, maximum: 99, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const seed = Number(p.seed);
    const NS = 'http://www.w3.org/2000/svg';
    const NARROW_SCALE = 0.7275 / 0.8594;
    const TOKENS_PER_SECOND = 0.22;
    const ENTRANCE = 20;
    const STAGGER = 2;
    const ENTRANCE_BURST = 2.5;
    const BAND = [6, 20];
    const MIN_CHAR_WIDTH = 0.4;
    const MAX_TOKENS = 48;
    const MIN_ROW_PX = 8;
    const OUTLINE_PX = 1.5;
    const FRAME_RATE = 30;
    const STYLES = ['solid', 'narrow', 'outline'];
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeOut = S.Easing.out(S.Easing.cubic);
    const fract = (x: number) => x - Math.floor(x);
    const mod = (n: number, m: number) => ((n % m) + m) % m;

    const unit = view.height / 720;
    const rowHeight = Math.max(MIN_ROW_PX, Number(p.fontSize) * unit);
    const reach = Math.ceil((view.height / 2 - rowHeight / 2) / rowHeight) + 1;
    const rowIds = Array.from({ length: reach * 2 + 1 }, (_, i) => i - reach);
    const token = `${String(p.text)} ${String(p.separator)} `;

    const outline = document.createElementNS(NS, 'filter');
    outline.setAttribute('id', 'type-wall-outline');
    const erode = document.createElementNS(NS, 'feMorphology');
    erode.setAttribute('in', 'SourceAlpha');
    erode.setAttribute('operator', 'erode');
    erode.setAttribute('radius', String(OUTLINE_PX * unit));
    erode.setAttribute('result', 'inner');
    const ring = document.createElementNS(NS, 'feComposite');
    ring.setAttribute('in', 'SourceAlpha');
    ring.setAttribute('in2', 'inner');
    ring.setAttribute('operator', 'out');
    ring.setAttribute('result', 'ring');
    const flood = document.createElementNS(NS, 'feFlood');
    flood.setAttribute('flood-color', String(p.color));
    const clip = document.createElementNS(NS, 'feComposite');
    clip.setAttribute('in2', 'ring');
    clip.setAttribute('operator', 'in');
    [erode, ring, flood, clip].forEach((node) => outline.appendChild(node));
    const defs = S.h('defs', null) as SVGElement;
    defs.appendChild(outline);
    const filterHost = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } }, defs);

    const rows = rowIds.map((row) => {
      const style = row === 0 ? 'solid' : STYLES[mod(row, STYLES.length)];
      const narrow = style === 'narrow';
      const size = narrow ? rowHeight * NARROW_SCALE : rowHeight;
      const count = Math.min(MAX_TOKENS, Math.ceil(view.width / (Math.max(1, Array.from(token).length) * MIN_CHAR_WIDTH * size)) + 2);
      const direction = Math.abs(row) % 2 === 0 ? -1 : 1;
      const velocity = (TOKENS_PER_SECOND * (0.7 + 0.6 * S.random(`type-wall-${seed}-speed-${row}`))) / FRAME_RATE;
      const phase = S.random(`type-wall-${seed}-phase-${row}`);
      const band = row === 0 ? (S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: String(p.accent) } }) as HTMLElement) : null;
      const strip = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: 'max-content', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'pre', fontFamily: narrow ? "Anton, 'Arial Narrow', sans-serif" : 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: size, lineHeight: 1, fontWeight: narrow ? 400 : 900, color: row === 0 ? String(p.accentText) : String(p.color), filter: style === 'outline' ? 'url(#type-wall-outline)' : undefined } }, Array.from({ length: count }, () => S.h('span', null, token))) as HTMLElement;
      const box = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: view.height / 2 + (row - 0.5) * rowHeight, height: rowHeight } }, band, strip) as HTMLElement;
      return { row, direction, velocity, phase, count, band, strip, box };
    });
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, filterHost, rows.map((r) => r.box)));

    return (frame) => {
      const t = (frame * FRAME_RATE) / view.fps;
      const bandScale = S.interpolate(t, BAND, [0, 1], { ...clamped, easing: easeOut });

      rows.forEach((r) => {
        const e = easeOut(Math.min(1, Math.max(0, (t - STAGGER * Math.abs(r.row)) / ENTRANCE)));
        const travel = r.phase + r.velocity * t + ENTRANCE_BURST * e;
        const shift = (r.direction < 0 ? -fract(travel) : fract(travel) - 1) || 0;
        const hidden = `${(1 - e) * 100}%`;

        r.box.style.clipPath = r.direction < 0 ? `inset(0 0 0 ${hidden})` : `inset(0 ${hidden} 0 0)`;
        r.strip.style.transform = `translateX(${(shift * 100) / r.count}%)`;
        if (r.band) {
          r.band.style.transform = `scaleX(${bandScale})`;
        }
      });
    };
  }
};
