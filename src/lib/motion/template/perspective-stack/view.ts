import { MEDIA_LIST } from '../media-list';
import { MEDIA_SLOT } from '../soft-settle';

export const PS_VIEW = String.raw`
${MEDIA_LIST}
${MEDIA_SLOT}
const CARD_ASPECT = 1.08;
const DECK_Y = 0.4;
const FLOOR_Y = 0.86;
const FLOOR_W = 0.94;
const FLOOR_H = 0.34;
const PERSPECTIVE = 2.4;
const BLOB_CLASSES = ['ps-blob ps-blob-a', 'ps-blob ps-blob-b', 'ps-blob ps-blob-c'];

root.insertAdjacentHTML('beforeend', '<div class="ps"><div class="ps-floor"><div class="ps-plate ps-plate-back"></div><div class="ps-plate ps-plate-front"><div class="ps-liquid"></div></div></div><div class="ps-deck"></div><p class="ps-caption"></p></div>');

const scene = root.querySelector('.ps');
const deck = root.querySelector('.ps-deck');
const floor = root.querySelector('.ps-floor');
const liquid = root.querySelector('.ps-liquid');
const caption = root.querySelector('.ps-caption');
const blobs = BLOB_CLASSES.map((c) => make(liquid, 'i', c));

let cache = { layoutKey: '', layout: null, buildKey: '', nodes: [], unit: 1, lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.count, p.chains]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: deckLayout(p), buildKey: '' };
  }
  return cache.layout;
};

const build = (p, layout, width, height) => {
  const key = JSON.stringify([p.media, layout.cards.length, p.deckSize, width, height]);
  if (key === cache.buildKey) {
    return cache.nodes;
  }
  const items = mediaList(p.media);
  const unit = Math.min(width, height);
  const w = unit * p.deckSize;
  const h = w * CARD_ASPECT;
  deck.innerHTML = '';
  deck.style.width = width + 'px';
  deck.style.height = height + 'px';
  deck.style.perspective = unit * PERSPECTIVE + 'px';
  deck.style.perspectiveOrigin = '50% ' + DECK_Y * 100 + '%';
  const nodes = layout.cards.map((card) => {
    const node = make(deck, 'div', 'ps-card ps-' + card.kind);
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    node.style.left = width / 2 - w / 2 + 'px';
    node.style.top = height * DECK_Y - h / 2 + 'px';
    const video = card.kind === 'photo' ? mountMedia(make(node, 'div', 'ps-photo'), items.length ? items[card.media % items.length] : null) : null;
    return { node, video };
  });
  const fw = width * FLOOR_W;
  const fh = unit * FLOOR_H;
  floor.style.width = fw + 'px';
  floor.style.height = fh + 'px';
  floor.style.left = (width - fw) / 2 + 'px';
  floor.style.top = height * FLOOR_Y - fh / 2 + 'px';
  floor.style.perspective = unit * PERSPECTIVE + 'px';
  cache = { ...cache, buildKey: key, nodes, unit };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.productCard, p.colourA, p.colourB, p.colourC, p.floorBack, p.floorFront, p.liquidA, p.liquidB, p.liquidC, p.radius, p.floorTilt, p.caption, p.ink, p.font]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ps-bg', p.background);
  s.setProperty('--ps-product', p.productCard);
  s.setProperty('--ps-a', p.colourA);
  s.setProperty('--ps-b', p.colourB);
  s.setProperty('--ps-c', p.colourC);
  s.setProperty('--ps-floor-back', p.floorBack);
  s.setProperty('--ps-floor-front', p.floorFront);
  s.setProperty('--ps-liquid-a', p.liquidA);
  s.setProperty('--ps-liquid-b', p.liquidB);
  s.setProperty('--ps-liquid-c', p.liquidC);
  s.setProperty('--ps-radius', p.radius + '%');
  s.setProperty('--ps-floor-tilt', p.floorTilt + 'deg');
  s.setProperty('--ps-ink', p.ink);
  s.setProperty('--ps-font', fontOf(p.font));
  caption.textContent = p.caption;
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  paintLook(p);
  const layout = layoutFor(p);
  const nodes = build(p, layout, width, height);
  const unit = cache.unit;
  const f = stackFrame(layout, p, t, duration);

  f.cards.forEach((c, i) => {
    const s = nodes[i].node.style;
    s.zIndex = String(c.order);
    s.transform = 'translate3d(' + c.x * width + 'px, ' + c.y * height + 'px, ' + c.z * unit + 'px) rotateY(' + c.yaw + 'deg) rotateX(' + c.pitch + 'deg) rotateZ(' + c.roll + 'deg) scale(' + c.scale + ')';
    seekVideo(nodes[i].video, t);
  });
  f.blobs.forEach((b, i) => {
    blobs[i].style.transform = 'translate3d(' + b.x * 100 + '%, ' + b.y * 100 + '%, 0) rotate(' + b.turn + 'deg)';
  });
  floor.style.transform = 'translate3d(' + f.sway * unit + 'px, 0, 0)';
  caption.style.fontSize = (p.captionSize / 100) * unit + 'px';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
