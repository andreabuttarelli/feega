import { MEDIA_LIST } from '../media-list';

export const STACK_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="sw"></div>');

const scene = root.querySelector('.sw');

let cache = { key: '', cards: [], words: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const mediaHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" draggable="false" src="' + item.src + '">';
};

const build = (p, f) => {
  const key = JSON.stringify([p.media, f.cards.length, f.words.map((w) => w.text)]);
  if (key === cache.key) {
    return cache;
  }
  const items = mediaList(p.media);
  scene.innerHTML = '';
  const cards = f.cards.map((c) => {
    const node = document.createElement('div');
    node.className = 'sw-card';
    node.innerHTML = mediaHtml(items.length ? items[c.media % items.length] : null);
    scene.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, inner: node.firstElementChild, video };
  });
  const words = f.words.map((w) => {
    const node = document.createElement('div');
    node.className = 'sw-word';
    node.textContent = w.text;
    scene.appendChild(node);
    return node;
  });
  cache = { ...cache, key, cards, words };
  return cache;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--sw-bg', p.background);
  s.setProperty('--sw-ink', p.textColor);
  s.setProperty('--sw-empty', p.placeholderColor);
  s.setProperty('--sw-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
  s.setProperty('--sw-weight', String(p.fontWeight));
  s.setProperty('--sw-tracking', p.tracking + 'em');
};

const paintCard = (card, c, t, width) => {
  const s = card.node.style;
  const visible = c.x + c.w > 0 && c.x < width;
  s.width = c.w + 'px';
  s.height = c.h + 'px';
  s.transform = 'translate3d(' + c.x + 'px, ' + c.y + 'px, 0)';
  s.visibility = visible ? 'visible' : 'hidden';
  if (card.inner) {
    card.inner.style.transform = 'scale(' + c.zoom + ')';
  }
  seekVideo(card.video, t);
};

const paintWord = (s, w) => {
  s.fontSize = w.size + 'px';
  s.left = w.x + 'px';
  s.top = w.y + 'px';
  s.opacity = String(w.opacity);
  s.transform = 'translate3d(-50%, ' + w.rise + 'em, 0)';
  s.visibility = w.opacity > 0.002 ? 'visible' : 'hidden';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const f = stackFrame(p, t, duration, width, height);
  const nodes = build(p, f);
  paintLook(p);
  f.cards.forEach((c, i) => paintCard(nodes.cards[i], c, t, width));
  f.words.forEach((w, i) => paintWord(nodes.words[i].style, w));
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
