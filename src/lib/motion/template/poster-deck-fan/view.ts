import { MEDIA_LIST } from '../media-list';
import { MEDIA_SLOT } from '../soft-settle';

export const PD_VIEW = String.raw`
${MEDIA_LIST}
${MEDIA_SLOT}
const PERSPECTIVE = 3;
const RINGS = {
  a: [[0.2, 0.55, 0.28], [0.62, 0.3, 0.2], [0.72, 0.68, 0.34], [0.12, 0.8, 0.14]],
  b: [[0.3, 0.3, 0.22], [0.66, 0.62, 0.32], [0.14, 0.72, 0.16]]
};

root.insertAdjacentHTML('beforeend', '<div class="pd"><div class="pd-deck"></div></div>');

const scene = root.querySelector('.pd');
const deck = root.querySelector('.pd-deck');

let cache = { layoutKey: '', layout: null, buildKey: '', nodes: [], unit: 1, lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.count]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: fanLayout(p), buildKey: '' };
  }
  return cache.layout;
};

const poster = (host, side, p) => {
  const face = make(host, 'div', 'pd-face pd-face-' + side);
  make(face, 'span', 'pd-small pd-head').textContent = p[side + 'Top'];
  const title = make(face, 'div', 'pd-title');
  linesOf(p[side + 'Title']).slice(0, 3).forEach((line) => (make(title, 'span', 'pd-title-line').textContent = line));
  if (p.rings) {
    RINGS[side].forEach(([x, y, d]) => {
      const ring = make(face, 'i', 'pd-ring');
      ring.style.left = (x - d / 2) * 100 + '%';
      ring.style.top = (y - d / 2) * 100 + '%';
      ring.style.width = d * 100 + '%';
      ring.style.height = d * 100 + '%';
    });
  }
  make(face, 'span', 'pd-small pd-foot').textContent = p[side + 'Bottom'];
};

const plainFace = (className) => (sheet) => {
  make(sheet, 'div', 'pd-face ' + className);
  return null;
};

const FACES = {
  front: (sheet, card, items, p) => {
    poster(sheet, 'a', p);
    poster(sheet, 'b', p);
    return null;
  },
  photo: (sheet, card, items) => mountMedia(make(sheet, 'div', 'pd-face pd-photo'), items.length ? items[card.media % items.length] : null),
  paper: plainFace('pd-paper'),
  accent: plainFace('pd-accent'),
  dark: plainFace('pd-dark')
};

const build = (p, layout, width, height) => {
  const key = JSON.stringify([p.media, layout.n, p.cardSize, p.aTop, p.aTitle, p.aBottom, p.bTop, p.bTitle, p.bBottom, p.rings, width, height]);
  if (key === cache.buildKey) {
    return cache.nodes;
  }
  const items = mediaList(p.media);
  const unit = Math.min(width, height);
  const c = unit * p.cardSize;
  deck.innerHTML = '';
  scene.style.perspective = unit * PERSPECTIVE + 'px';
  deck.style.left = width / 2 + 'px';
  deck.style.top = height / 2 + 'px';
  const nodes = [...layout.cards].reverse().map((card) => {
    const node = make(deck, 'div', 'pd-card');
    node.style.width = c + 'px';
    node.style.height = c + 'px';
    node.style.left = -c / 2 + 'px';
    node.style.top = -c / 2 + 'px';
    node.style.fontSize = c + 'px';
    const sheet = make(node, 'div', 'pd-sheet');
    const video = FACES[card.kind](sheet, card, items, p);
    return { k: card.k, node, sheet, video };
  }).sort((a, b) => a.k - b.k);
  cache = { ...cache, buildKey: key, nodes, unit: c };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.aColor, p.bColor, p.ink, p.paperColor, p.darkColor, p.accentColor, p.placeholderColor, p.font, p.weight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--pd-bg', p.background);
  s.setProperty('--pd-face-a', p.aColor);
  s.setProperty('--pd-face-b', p.bColor);
  s.setProperty('--pd-ink', p.ink);
  s.setProperty('--pd-paper', p.paperColor);
  s.setProperty('--pd-dark', p.darkColor);
  s.setProperty('--pd-accent', p.accentColor);
  s.setProperty('--pd-empty', p.placeholderColor);
  s.setProperty('--pd-font', fontOf(p.font));
  s.setProperty('--pd-weight', String(p.weight));
  s.setProperty('--pd-tracking', p.tracking + 'em');
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  paintLook(p);
  const layout = layoutFor(p);
  const nodes = build(p, layout, width, height);
  const c = cache.unit;
  const f = fanFrame(layout, p, t, duration);
  const d = f.deck;

  deck.style.transform = 'translate3d(' + d.shiftX * width + 'px, ' + d.shiftY * height + 'px, 0) rotateX(' + d.x + 'deg) rotateY(' + d.y + 'deg) rotateZ(' + d.z + 'deg)';
  f.cards.forEach((card, i) => {
    const node = nodes[i];
    node.node.style.transform = 'translate3d(' + card.shift * c + 'px, 0, ' + (card.depth + card.lift) * c + 'px) rotateZ(' + card.fan + 'deg)';
    node.sheet.style.transform = 'rotateX(' + card.riffle + 'deg) rotateY(' + card.turn + 'deg)';
    seekVideo(node.video, t);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
