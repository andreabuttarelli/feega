import { MEDIA_LIST } from '../media-list';
import { MEDIA_SLOT } from '../soft-settle';

export const SS_VIEW = String.raw`
${MEDIA_LIST}
${MEDIA_SLOT}
const META_SPOTS = ['ss-m1', 'ss-m2', 'ss-m3', 'ss-m4', 'ss-m5'];
const DOT_MARKS = ['ss-sq ss-a', 'ss-sq ss-b', 'ss-sq ss-c', 'ss-ci ss-d', 'ss-ci ss-e'];

root.insertAdjacentHTML('beforeend', '<div class="ss"><div class="ss-title"><h1 class="ss-headline"></h1></div><div class="ss-cards"></div><div class="ss-meta"></div></div>');

const scene = root.querySelector('.ss');
const headline = root.querySelector('.ss-headline');
const cardsHost = root.querySelector('.ss-cards');
const metaHost = root.querySelector('.ss-meta');

let cache = { layoutKey: '', layout: null, buildKey: '', nodes: [], lookKey: '', titleKey: '', words: [], metaKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.count]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: scatterLayout(p), buildKey: '' };
  }
  return cache.layout;
};

const FACES = {
  photo: (node, card, items) => mountMedia(node, items.length ? items[card.media % items.length] : null),
  round: (node, card, items) => mountMedia(node, items.length ? items[card.media % items.length] : null),
  dots: (node) => {
    DOT_MARKS.forEach((mark) => make(node, 'i', mark));
    return null;
  },
  block: () => null,
  type: (node, card, items, p) => {
    linesOf(p.typeCard).slice(0, 3).forEach((line, i) => {
      make(node, 'span', 'ss-type-' + i).textContent = line;
    });
    return null;
  }
};

const build = (p, layout, width, height) => {
  const key = JSON.stringify([p.media, p.typeCard, layout.n, p.cardSize, width, height]);
  if (key === cache.buildKey) {
    return cache.nodes;
  }
  const items = mediaList(p.media);
  const unit = Math.min(width, height) * p.cardSize;
  cardsHost.innerHTML = '';
  const nodes = layout.cards.map((card) => {
    const node = make(cardsHost, 'div', 'ss-card ss-' + card.kind + (card.hero ? ' ss-hero' : ''));
    const h = card.s * unit;
    const w = h * card.a;
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    node.style.left = -w / 2 + 'px';
    node.style.top = -h / 2 + 'px';
    node.style.fontSize = h * 0.155 + 'px';
    const video = FACES[card.kind](node, card, items, p);
    return { node, video };
  });
  cache = { ...cache, buildKey: key, nodes };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.ink, p.blockColor, p.dotsColor, p.typeCardColor, p.placeholderColor, p.font, p.weight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ss-bg', p.background);
  s.setProperty('--ss-ink', p.ink);
  s.setProperty('--ss-block', p.blockColor);
  s.setProperty('--ss-dots', p.dotsColor);
  s.setProperty('--ss-paper', p.typeCardColor);
  s.setProperty('--ss-empty', p.placeholderColor);
  s.setProperty('--ss-font', fontOf(p.font));
  s.setProperty('--ss-weight', String(p.weight));
  s.setProperty('--ss-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.headline]);
  if (key !== cache.titleKey) {
    const words = String(p.headline || '').trim().split(/\s+/).filter(Boolean);
    headline.innerHTML = '';
    const nodes = words.map((word, i) => {
      const span = make(headline, 'span', 'ss-word');
      span.textContent = word + (i < words.length - 1 ? ' ' : '');
      return span;
    });
    cache = { ...cache, titleKey: key, words: nodes };
  }
  return cache.words;
};

const paintMeta = (p) => {
  const key = JSON.stringify([p.meta]);
  if (key === cache.metaKey) {
    return;
  }
  cache = { ...cache, metaKey: key };
  metaHost.innerHTML = '';
  String(p.meta || '').split('\n').slice(0, META_SPOTS.length).forEach((line, i) => {
    make(metaHost, 'span', 'ss-m ' + META_SPOTS[i]).textContent = line.trim();
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  paintLook(p);
  paintMeta(p);
  const layout = layoutFor(p);
  const nodes = build(p, layout, width, height);
  const words = paintTitle(p);
  const f = scatterFrame(layout, p, t, duration);

  f.cards.forEach((c, i) => {
    const s = nodes[i].node.style;
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.001 ? 'visible' : 'hidden';
    s.transform = 'translate3d(' + (c.x * width + c.dx * unit) + 'px, ' + (c.y * height + c.dy * unit) + 'px, 0) scale(' + c.scale + ')';
    seekVideo(nodes[i].video, t);
  });
  headline.style.fontSize = (p.headlineSize / 100) * unit + 'px';
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
  metaHost.style.opacity = String(f.meta);
  metaHost.style.fontSize = (p.metaSize / 100) * unit + 'px';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
