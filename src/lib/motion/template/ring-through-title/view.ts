import { MEDIA_LIST } from '../media-list';

export const RING_VIEW = String.raw`
${MEDIA_LIST}
const MEASURE_PX = 100;
const MAX_TITLE_HEIGHT = 0.42;

root.insertAdjacentHTML('beforeend', '<div class="rt"><div class="rt-cards"></div><div class="rt-title"><h1 class="rt-headline"></h1></div></div>');

const scene = root.querySelector('.rt');
const deck = root.querySelector('.rt-cards');
const title = root.querySelector('.rt-title');
const headline = root.querySelector('.rt-headline');

let cache = { layoutKey: '', layout: [], cardsKey: '', cards: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.cards, p.cardSize, p.cardAspect, p.variety]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: ringLayout(p) };
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
  deck.innerHTML = '';
  const cards = Array.from({ length: n }, (_, i) => {
    const node = document.createElement('div');
    node.className = 'rt-card';
    node.innerHTML = cardHtml(items.length ? items[i % items.length] : null) + '<i class="rt-shade"></i>';
    deck.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, shade: node.querySelector('.rt-shade'), video };
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--rt-bg', p.background);
  s.setProperty('--rt-ink', p.titleColor);
  s.setProperty('--rt-empty', p.placeholderColor);
  s.setProperty('--rt-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--rt-weight', String(p.fontWeight));
  s.setProperty('--rt-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = titleWords(p.title);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'rt-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(span);
    return span;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const fitTitle = (p, width, height) => {
  headline.style.fontSize = MEASURE_PX + 'px';
  const natural = Math.max(headline.offsetWidth, 1);
  headline.style.fontSize = Math.min((p.titleWidth * width * MEASURE_PX) / natural, MAX_TITLE_HEIGHT * height) + 'px';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const layout = layoutFor(p);
  const cards = buildCards(p, layout.length);
  const words = paintTitle(p);
  paintLook(p);
  fitTitle(p, width, height);
  const f = ringFrame(layout, p, t, duration);

  title.style.zIndex = String(f.titleLayer);
  f.cards.forEach((c, i) => {
    const card = cards[i];
    const s = card.node.style;
    s.width = c.w * unit + 'px';
    s.height = c.h * unit + 'px';
    s.transform = 'translate3d(calc(' + c.x * unit + 'px - 50%), calc(' + c.y * unit + 'px - 50%), 0)';
    s.zIndex = String(c.layer);
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
    card.shade.style.opacity = String(c.shade);
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
