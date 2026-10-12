import { MEDIA_LIST } from '../media-list';

export const PAPER_VIEW = String.raw`
${MEDIA_LIST}
const SVG_NS = 'http://www.w3.org/2000/svg';
const SHADE_GAIN = 1.5;
const SHADE_MAX = 0.26;
const PANEL_SHADE = 0.3;
const PERSPECTIVE = 2.4;
const PANEL_PAD = 0.08;
const SKETCH = 'M36 90 C35 76 37 64 42 55 C35 50 32 42 35 35 C39 25 51 21 58 27 C65 33 63 44 56 49 C63 54 69 64 67 76 C66 84 61 90 54 89 C48 88 48 80 53 77 C57 75 61 79 60 83 M42 55 C47 58 52 57 56 49 M45 36 C47 38 50 38 52 36';
const SHEETS = {
  cutout: { seed: 11, edge: 0.12, back: true, layers: [{ cols: 4, rows: 5, weight: 0.8 }, { cols: 11, rows: 13, weight: 0.4 }] },
  panel: { seed: 23, edge: 0, layers: [{ cols: 3, rows: 4, weight: 1 }] },
  paper: { seed: 37, edge: 0.16, layers: [{ cols: 5, rows: 6, weight: 0.9 }, { cols: 13, rows: 15, weight: 0.45 }] }
};

root.insertAdjacentHTML('beforeend', '<div class="pp"><div class="pp-stage"></div><div class="pp-labels"><b class="pp-brand"></b><span class="pp-left"></span><span class="pp-centre"></span><span class="pp-right"></span><i class="pp-mark"><svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4z"></path></svg></i><i class="pp-badge"></i></div></div>');

const scene = root.querySelector('.pp');
const stage = root.querySelector('.pp-stage');
const labels = {
  brand: root.querySelector('.pp-brand'),
  left: root.querySelector('.pp-left'),
  centre: root.querySelector('.pp-centre'),
  right: root.querySelector('.pp-right'),
  badge: root.querySelector('.pp-badge')
};

let cache = { key: '', cards: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const el = (tag, cls) => {
  const node = document.createElement(tag);
  node.className = cls;
  return node;
};

const svgEl = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const polygon = (points) => 'polygon(' + points.map(([x, y]) => x.toFixed(2) + '% ' + y.toFixed(2) + '%').join(',') + ')';

const facetLayer = (seed, spec) => {
  const facets = crumple(seed, spec.cols, spec.rows);
  const svg = svgEl('svg', { class: 'pp-facets', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
  const polys = facets.map((f) => {
    const poly = svgEl('polygon', { points: f.points.map((q) => q.join(',')).join(' ') });
    svg.appendChild(poly);
    return poly;
  });
  return { svg, facets, polys, weight: spec.weight };
};

const mediaNode = (item) => {
  const node = el(item.video ? 'video' : 'img', 'pp-photo');
  if (item.video) {
    node.muted = true;
    node.playsInline = true;
    node.preload = 'auto';
    node.addEventListener('loadedmetadata', () => seekVideo(node, tl.time()));
  } else {
    node.decoding = 'sync';
  }
  node.src = item.src;
  return node;
};

const sheetOf = (kind, spec, p, items) => {
  const sheet = el('div', 'pp-sheet pp-' + kind);
  if (spec.edge) {
    sheet.style.clipPath = polygon(paperEdge(spec.seed, 44, spec.edge));
  }
  if (kind === 'cutout' && items.length) {
    const cut = el('div', 'pp-cut');
    cut.style.clipPath = polygon(paperEdge(spec.seed + 5, 36, 0.2));
    cut.appendChild(mediaNode(items[0]));
    sheet.appendChild(cut);
  }
  if (kind === 'panel') {
    sheet.appendChild(el('div', 'pp-lines'));
  }
  if (kind === 'paper') {
    const svg = svgEl('svg', { class: 'pp-sketch', viewBox: '0 0 100 100' });
    svg.appendChild(svgEl('path', { d: SKETCH, pathLength: '1' }));
    sheet.appendChild(svg);
  }
  const layers = spec.layers.map((l, i) => facetLayer(spec.seed + 100 * i, l));
  layers.forEach((l) => sheet.appendChild(l.svg));
  return { sheet, layers };
};

const build = (p, layout) => {
  const key = JSON.stringify([layout, p.media, p.lines, p.from, p.to, p.prefix]);
  if (key === cache.key) {
    return cache.cards;
  }
  const items = mediaList(p.media);
  stage.innerHTML = '';
  const cards = layout.map((card) => {
    const node = el('div', 'pp-card');
    node.style.zIndex = String(Math.round(card.z * 10));
    const spec = SHEETS[card.kind];
    if (spec.back) {
      const back = el('div', 'pp-sheet pp-back');
      back.style.clipPath = polygon(paperEdge(spec.seed + 1, 40, 0.18));
      node.appendChild(back);
    }
    const { sheet, layers } = sheetOf(card.kind, spec, p, items);
    node.appendChild(sheet);
    stage.appendChild(node);
    const lines = sheet.querySelector('.pp-lines');
    const rows = lines ? counterValues(p).map(() => lines.appendChild(el('div', 'pp-line'))) : [];
    return { card, node, layers, rows, video: sheet.querySelector('video'), sketch: sheet.querySelector('.pp-sketch path') };
  });
  cache = { ...cache, key, cards };
  return cards;
};

const paintLook = (p, unit) => {
  const key = JSON.stringify([p.background, p.panelColor, p.numberColor, p.cutoutColor, p.paperColor, p.inkColor, p.badgeColor, p.font, unit, p.brand, p.leftLabel, p.centreLabel, p.rightLabel]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--pp-bg', p.background);
  s.setProperty('--pp-panel', p.panelColor);
  s.setProperty('--pp-number', p.numberColor);
  s.setProperty('--pp-cutout', p.cutoutColor);
  s.setProperty('--pp-paper', p.paperColor);
  s.setProperty('--pp-ink', p.inkColor);
  s.setProperty('--pp-badge', p.badgeColor);
  s.setProperty('--pp-u', unit + 'px');
  s.setProperty('--pp-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  labels.brand.textContent = p.brand;
  labels.badge.textContent = p.brand;
  labels.left.textContent = p.leftLabel;
  labels.centre.textContent = p.centreLabel;
  labels.right.textContent = p.rightLabel;
};

const shadeSheet = (layer, pose, strength) => {
  layer.facets.forEach((f, i) => {
    const a = Math.max(-SHADE_MAX, Math.min(SHADE_MAX, facetShade(f.normal, pose) * SHADE_GAIN * strength * layer.weight));
    layer.polys[i].setAttribute('fill', a > 0 ? '#ffffff' : '#000000');
    layer.polys[i].setAttribute('fill-opacity', Math.abs(a).toFixed(3));
  });
};

const writeLines = (rows, card, unit, p, t) => {
  const lines = counterFrame(p, t, duration);
  const inner = { w: card.w * unit * (1 - 2 * PANEL_PAD), h: card.h * unit * (1 - 2 * PANEL_PAD) };
  const chars = Math.max(...lines.map((l) => l.text.length));
  const sizes = counterSizes(lines.length, inner.w, inner.h, chars);
  lines.forEach((l, i) => {
    const s = rows[i].style;
    rows[i].textContent = l.text;
    s.fontSize = sizes[i].toFixed(2) + 'px';
    s.opacity = l.opacity.toFixed(3);
    s.transform = 'translateY(' + (l.rise * sizes[i]).toFixed(2) + 'px)';
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const layout = paperLayout(width / height);
  const cards = build(p, layout);
  paintLook(p, unit);
  const strength = Number(p.crumple);

  cards.forEach((c, i) => {
    const pose = cardPose(c.card, i, t, duration);
    const s = c.node.style;
    s.width = c.card.w * unit + 'px';
    s.height = c.card.h * unit + 'px';
    s.transform = 'translate(' + (width / 2 + (pose.x - c.card.w / 2) * unit).toFixed(2) + 'px, ' + (height / 2 + (pose.y - c.card.h / 2) * unit).toFixed(2) + 'px) perspective(' + (PERSPECTIVE * unit).toFixed(0) + 'px) rotateY(' + pose.ry.toFixed(3) + 'deg) rotateX(' + pose.rx.toFixed(3) + 'deg) rotateZ(' + pose.rz.toFixed(3) + 'deg)';
    c.layers.forEach((l) => shadeSheet(l, pose, c.card.kind === 'panel' ? strength * PANEL_SHADE : strength));
    if (c.rows.length) {
      writeLines(c.rows, c.card, unit, p, t);
    }
    if (c.sketch) {
      c.sketch.style.strokeDashoffset = String(1 - sketchDrawn(t, duration));
    }
    seekVideo(c.video, t);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
