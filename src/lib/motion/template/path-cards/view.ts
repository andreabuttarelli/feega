import { MEDIA_LIST } from '../media-list';

export const PATH_VIEW = String.raw`
${MEDIA_LIST}
const SVG_NS = 'http://www.w3.org/2000/svg';
const STARS = '★★★★★';

root.insertAdjacentHTML('beforeend', '<div class="pc"><div class="pc-world"><svg class="pc-path"><path pathLength="1"></path></svg><i class="pc-dot"></i><div class="pc-cards"></div></div></div>');

const scene = root.querySelector('.pc');
const world = root.querySelector('.pc-world');
const svg = root.querySelector('.pc-path');
const line = root.querySelector('.pc-path path');
const deck = root.querySelector('.pc-cards');
const dot = root.querySelector('.pc-dot');

let cache = { layoutKey: '', layout: null, cardsKey: '', cards: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

const photoOf = (item) => {
  if (!item) {
    return el('div', 'pc-photo');
  }
  const node = el(item.video ? 'video' : 'img', 'pc-photo');
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

const placeCard = (p, i, items) => {
  const card = el('div', 'pc-card pc-place');
  card.appendChild(photoOf(items.length ? items[i % items.length] : null));
  const row = el('div', 'pc-row');
  row.appendChild(el('span', 'pc-name', listOf(p.places)[i] || ''));
  const rating = listOf(p.ratings)[i];
  if (rating) {
    const rate = el('span', 'pc-rate', rating + ' ');
    rate.appendChild(el('span', 'pc-star', '★'));
    row.appendChild(rate);
  }
  card.appendChild(row);
  card.appendChild(el('div', 'pc-address', listOf(p.addresses)[i] || ''));
  return card;
};

const reviewCard = (p, i) => {
  const card = el('div', 'pc-card pc-review');
  const name = listOf(p.reviewers)[i] || '';
  const who = el('div', 'pc-who');
  who.appendChild(el('span', 'pc-avatar', name.charAt(0).toUpperCase()));
  who.appendChild(el('span', '', name));
  card.appendChild(who);
  card.appendChild(el('div', 'pc-stars', STARS));
  card.appendChild(el('p', 'pc-text', listOf(p.reviews)[i] || ''));
  return card;
};

const layoutFor = (p, aspect) => {
  const key = JSON.stringify([p.places, aspect >= 1]);
  if (key !== cache.layoutKey) {
    const layout = pathLayout(p, aspect);
    cache = { ...cache, layoutKey: key, layout, cardsKey: '' };
  }
  return cache.layout;
};

const buildCards = (p, layout) => {
  const key = JSON.stringify([cache.layoutKey, p.media, p.addresses, p.ratings, p.reviewers, p.reviews]);
  if (key === cache.cardsKey) {
    return cache.cards;
  }
  const items = mediaList(p.media);
  deck.innerHTML = '';
  const cards = layout.cards.map((c) => {
    const node = c.kind === 'place' ? placeCard(p, c.stop, items) : reviewCard(p, c.stop);
    deck.appendChild(node);
    return { node, video: node.querySelector('video') };
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const paintLook = (p, unit) => {
  const key = JSON.stringify([p.background, p.cardColor, p.ink, p.accent, p.starColor, p.font, p.cardSize, unit]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--pc-bg', p.background);
  s.setProperty('--pc-card', p.cardColor);
  s.setProperty('--pc-ink', p.ink);
  s.setProperty('--pc-accent', p.accent);
  s.setProperty('--pc-star', p.starColor);
  s.setProperty('--pc-u', unit * p.cardSize + 'px');
  s.setProperty('--pc-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
};

const drawPath = (layout, unit, p) => {
  line.setAttribute('d', 'M' + layout.points.map((q) => (q.x * unit).toFixed(2) + ' ' + (q.y * unit).toFixed(2)).join('L'));
  line.style.strokeWidth = (p.pathWidth / 100) * unit + 'px';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const layout = layoutFor(p, width / height);
  const cards = buildCards(p, layout);
  paintLook(p, unit);
  drawPath(layout, unit, p);
  const f = pathFrame(layout, p, t, duration);

  world.style.transform = 'translate3d(' + (width / 2 - f.camera.x * unit * f.zoom) + 'px, ' + (height / 2 - f.camera.y * unit * f.zoom) + 'px, 0) scale(' + f.zoom + ')';
  world.style.opacity = String(f.fade);
  line.style.strokeDashoffset = String(1 - f.drawn);
  line.style.opacity = f.drawn > 0 ? '1' : '0';
  dot.style.transform = 'translate3d(' + f.head.x * unit + 'px, ' + f.head.y * unit + 'px, 0)';
  dot.style.opacity = String(f.dot);
  f.cards.forEach((c, i) => {
    const s = cards[i].node.style;
    s.transform = 'translate3d(' + c.x * unit + 'px, ' + (c.y + c.rise) * unit + 'px, 0) translate(-50%, -50%) scale(' + c.scale + ')';
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
    s.filter = c.blur > 0.05 ? 'blur(' + c.blur.toFixed(2) + 'px)' : 'none';
    seekVideo(cards[i].video, t);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
