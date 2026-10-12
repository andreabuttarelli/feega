import { MEDIA_LIST } from '../media-list';

export const SCATTER_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="st"><div class="st-world"></div><div class="st-title"><h1 class="st-headline"></h1></div></div>');

const scene = root.querySelector('.st');
const world = root.querySelector('.st-world');
const headline = root.querySelector('.st-headline');

let cache = { layoutKey: '', layout: [], cardsKey: '', cards: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const titleBox = (unit) => ({ hw: headline.offsetWidth / unit / 2, hh: headline.offsetHeight / unit / 2 });

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const title = titleBox(Math.min(width, height));
  const key = JSON.stringify([width, height, p.count, p.cardScale, title.hw.toFixed(3), title.hh.toFixed(3)]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: scatterLayout(p, width, height, title) };
  }
  return cache.layout;
};

const cardHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const buildCards = (p, n) => {
  const key = JSON.stringify([p.media, n]);
  if (key === cache.cardsKey) {
    return cache.cards;
  }
  const items = mediaList(p.media);
  world.innerHTML = '';
  const cards = Array.from({ length: n }, (_, i) => {
    const node = document.createElement('div');
    node.className = 'st-card';
    node.innerHTML = cardHtml(items.length ? items[i % items.length] : null);
    world.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.placeholderColor, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--st-bg', p.background);
  s.setProperty('--st-ink', p.titleColor);
  s.setProperty('--st-empty', p.placeholderColor);
  s.setProperty('--st-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
  s.setProperty('--st-size', String(p.fontSize));
  s.setProperty('--st-weight', String(p.fontWeight));
  s.setProperty('--st-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = String(p.title || '').trim().split(/\s+/).filter(Boolean);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'st-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(span);
    return span;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const unit = Math.min(sizeOf().width, sizeOf().height);
  paintLook(p);
  const words = paintTitle(p);
  const layout = layoutFor(p);
  const cards = buildCards(p, layout.length);
  const f = scatterFrame(layout, p, t, duration, words.length);

  f.cards.forEach((c, i) => {
    const card = cards[i];
    const s = card.node.style;
    s.width = c.w * unit + 'px';
    s.height = c.h * unit + 'px';
    s.transform = 'translate3d(' + (c.x - c.w / 2) * unit + 'px, ' + (c.y - c.h / 2) * unit + 'px, 0) scale(' + c.scale + ')';
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
    seekVideo(card.video, t);
  });
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
