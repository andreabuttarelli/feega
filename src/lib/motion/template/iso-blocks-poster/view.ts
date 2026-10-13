export const ISO_BLOCKS_CSS = String.raw`
.ib {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ib-paper);
  color: var(--ib-ink);
  font-family: var(--ib-font);
  -webkit-font-smoothing: antialiased;
}

.ib-shapes {
  position: absolute;
  inset: 0;
}

.ib-text {
  position: absolute;
  margin: 0;
  white-space: pre;
}

.ib-header {
  font-weight: 600;
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.ib-mark {
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0.14em;
  text-align: center;
}

.ib-face {
  position: absolute;
  margin: 0;
  white-space: pre;
  color: var(--ib-paper);
  font-family: var(--ib-block-font);
  font-weight: 500;
  line-height: 0.92;
  letter-spacing: 0.02em;
  transform-origin: 0 0;
}

.ib-info {
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.ib-rule {
  position: absolute;
  background: var(--ib-ink);
}

.ib-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ib-ink);
  color: var(--ib-accent);
  font-weight: 600;
  letter-spacing: -0.04em;
}
`;

export const ISO_BLOCKS_VIEW = String.raw`
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const MARGIN = 0.05;
const HEAD_TOP = 0.05;
const MARK_WIDTH = 0.22;
const RULE_X = 0.31;
const HEAD_X = 0.335;
const FACE_PAD = 0.12;
const INFO_SIZE = 0.021;
const INFO_TOP = 0.72;
const MARKER = 0.085;
const GLYPH = 0.64;

root.insertAdjacentHTML('beforeend', '<div class="ib"></div>');
const scene = root.querySelector('.ib');

const pt = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
const polygon = (points, fill, attrs) => '<polygon' + attrs + ' points="' + points.map(pt).join(' ') + '" fill="' + fill + '"/>';

const geometry = (line, width, height) => {
  const [x, y, length, depth, tall] = numbersOf(line);
  const u = [COS, SIN];
  const v = [COS, -SIN];
  const down = [0, 1];
  const p0 = [(x * width) / 100, (y * height) / 100];
  const a = (length * width) / 100;
  const b = (depth * width) / 100;
  const h = (tall * width) / 100;
  const p1 = add(p0, u, a);
  const p2 = add(p1, v, b);
  const p3 = add(p0, v, b);
  return { p0, p1, p2, p3, a, b, h, top: [p0, p1, p2, p3], hull: [p0, p3, p2, add(p2, down, h), add(p1, down, h), add(p0, down, h)] };
};

const faceText = (g, i, text, size) => {
  const leftFace = i % 3 === 0;
  const origin = leftFace ? g.p0 : g.p1;
  const pad = FACE_PAD * (leftFace ? g.a : g.b);
  const along = leftFace ? [COS, SIN] : [COS, -SIN];
  const lines = linesOf(text);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const span = leftFace ? g.a : g.b;
  const fit = Math.min(size, (span * (1 - 2 * FACE_PAD)) / (longest * GLYPH), (g.h * 0.78) / (lines.length * 0.92));
  const start = add(add(origin, along, pad), [0, 1], g.h * 0.12);
  const matrix = 'matrix(' + along[0].toFixed(4) + ',' + along[1].toFixed(4) + ',0,1,0,0)';
  return '<div class="ib-face"' + part('lineup', i) + ' style="left:' + start[0] + 'px;top:' + start[1] + 'px;font-size:' + fit + 'px;transform:' + matrix + '">' + escaped(text) + '</div>';
};

const markSvg = (size, ink, paper) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="' + ink + '"/><polygon points="50,22 78,70 22,70" fill="' + paper + '"/><circle cx="50" cy="56" r="7" fill="' + ink + '"/></svg>';

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--ib-paper', p.paper);
  s.setProperty('--ib-ink', p.ink);
  s.setProperty('--ib-accent', p.accent);
  s.setProperty('--ib-font', fontOf(p.font));
  s.setProperty('--ib-block-font', fontOf(p.blockFont));

  const px = (v) => (v * width) / 100;
  const margin = MARGIN * width;
  const headTop = HEAD_TOP * width;
  const headSize = px(p.headerSize);
  const headLines = linesOf(p.header).length;
  const headHeight = headLines * headSize * 0.98;

  const markSize = MARK_WIDTH * width * 0.62;
  const mark = '<div class="ib-text ib-mark"' + part('mark') + ' style="left:' + margin + 'px;top:' + headTop + 'px;width:' + MARK_WIDTH * width + 'px;font-size:' + headSize * 0.42 + 'px">' + markSvg(markSize, p.ink, p.paper) + '<div style="margin-top:' + headSize * 0.3 + 'px">' + escaped(p.mark) + '</div></div>';
  const rule = '<div class="ib-rule" style="' + box(RULE_X * width, headTop + headSize * 0.1, Math.max(2, width * 0.0018), headHeight) + '"></div>';
  const header = '<div class="ib-text ib-header"' + part('header') + ' style="left:' + HEAD_X * width + 'px;top:' + headTop + 'px;font-size:' + headSize + 'px">' + escaped(p.header) + '</div>';

  const lines = linesOf(p.blocks).filter((l) => l.trim());
  const texts = String(p.lineup || '').split(/\n\s*\n/);
  const shapes = lines.map((line) => geometry(line, width, height));
  const hulls = shapes.map((g, i) => polygon(g.hull, p.ink, part('blocks', i))).join('');
  const accentTop = shapes[p.accentBlock - 1] ? polygon(shapes[p.accentBlock - 1].top, p.accent, '') : '';
  const svg = '<svg class="ib-shapes" width="' + width + '" height="' + height + '">' + hulls + accentTop + '</svg>';
  const faces = shapes.map((g, i) => (texts[i] ? faceText(g, i, texts[i], px(p.blockTextSize)) : '')).join('');

  const host = shapes[p.accentBlock - 1] ?? shapes[0];
  const d = MARKER * width;
  const centre = host ? [(host.p0[0] + host.p2[0]) / 2, (host.p0[1] + host.p2[1]) / 2] : [width / 2, height / 2];
  const marker = '<div class="ib-marker"' + part('marker') + ' style="' + box(centre[0] - d / 2, centre[1] - d / 2, d, d) + 'font-size:' + d * 0.4 + 'px">' + escaped(p.marker) + '</div>';

  const infoSize = INFO_SIZE * width;
  const infoTop = INFO_TOP * height;
  const infoLines = linesOf(p.info).length;
  const info = '<div class="ib-text ib-info"' + part('info') + ' style="left:' + (margin + infoSize) + 'px;top:' + infoTop + 'px;font-size:' + infoSize + 'px">' + escaped(p.info) + '</div>';
  const infoRule = '<div class="ib-rule" style="' + box(margin, infoTop, Math.max(2, width * 0.0018), infoLines * infoSize * 1.12) + '"></div>';
  const caption = upright(p.caption, width - margin * 0.7, height - margin, infoSize * 0.85, p.ink);

  scene.innerHTML = svg + faces + marker + mark + rule + header + info + infoRule + caption;
};
`;
