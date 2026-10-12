import { MEDIA_LIST } from '../media-list';

export const COMMENTS_VIEW = String.raw`
${MEDIA_LIST}
const RISE = 0.035;
const STAR = '★';
const TINTS = ['#7c8cf8', '#f2895c', '#4fb39a', '#d46a9f', '#5aa9e6', '#c9a227', '#8f7ae5', '#e4675f', '#3fa7a0', '#a17c5b'];

root.insertAdjacentHTML('beforeend', '<div class="cg"><div class="cg-grid"></div><div class="cg-measure"></div><i class="cg-veil"></i><div class="cg-title"><h1 class="cg-headline"></h1></div></div>');

const scene = root.querySelector('.cg');
const grid = root.querySelector('.cg-grid');
const measure = root.querySelector('.cg-measure');
const veil = root.querySelector('.cg-veil');
const headline = root.querySelector('.cg-headline');

let cache = { cardsKey: '', heights: [], nodes: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const fontOf = (name) => (String(name).includes(',') ? name : '"' + name + '", system-ui, sans-serif');

const tintOf = (name) => TINTS[Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];

const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join('');

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) {
    node.textContent = text;
  }
  return node;
};

const avatarNode = (comment, picture) => {
  const avatar = element('span', 'cg-avatar');
  avatar.style.setProperty('--cg-tint', tintOf(comment.name || comment.handle || '?'));
  if (!picture) {
    avatar.textContent = initialsOf(comment.name || comment.handle.replace('@', ''));
    return avatar;
  }
  avatar.innerHTML = picture.video ? '<video muted playsinline preload="auto"></video>' : '<img decoding="sync">';
  avatar.firstChild.src = picture.src;
  return avatar;
};

const starsNode = (rating) => {
  const stars = element('div', 'cg-stars', STAR.repeat(rating));
  const empty = element('i', '', STAR.repeat(5 - rating));
  if (rating < 5) {
    stars.appendChild(empty);
  }
  return stars;
};

const cardNode = (comment, picture) => {
  const card = element('div', 'cg-card');
  if (comment.name || comment.handle) {
    const head = element('div', 'cg-head');
    const who = element('div', 'cg-who');
    head.appendChild(avatarNode(comment, picture));
    who.appendChild(element('span', 'cg-name', comment.name));
    who.appendChild(element('span', 'cg-handle', comment.handle));
    head.appendChild(who);
    if (comment.time) {
      head.appendChild(element('span', 'cg-time', comment.time));
    }
    card.appendChild(head);
  }
  if (comment.rating > 0) {
    card.appendChild(starsNode(comment.rating));
  }
  card.appendChild(element('p', 'cg-text', comment.text));
  return card;
};

const pictureOf = (pictures, index) => (pictures.length ? pictures[index % pictures.length] : null);

const buildCards = (p, size) => {
  const fonts = document.fonts ? document.fonts.status : '';
  const key = JSON.stringify([p.comments, p.avatars, p.cardWidth, p.gap, p.cardFont, size, fonts]);
  if (key === cache.cardsKey) {
    return;
  }
  const comments = parseComments(p.comments);
  const pictures = mediaList(p.avatars);
  const { cardWidth } = gridColumns(p, size);
  scene.style.setProperty('--cg-cw', cardWidth + 'px');
  scene.style.setProperty('--cg-card-font', fontOf(p.cardFont));
  measure.innerHTML = '';
  const probes = comments.map((c, i) => measure.appendChild(cardNode(c, pictureOf(pictures, i))));
  const heights = probes.map((node) => node.offsetHeight);
  measure.innerHTML = '';
  grid.innerHTML = '';
  const nodes = comments.length ? gridFrame(gridLayout(p, size, heights), p, 0, duration, size).cards.map((c) => {
    const node = grid.appendChild(cardNode(comments[c.index], pictureOf(pictures, c.index)));
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
  }) : [];
  cache = { ...cache, cardsKey: key, heights, nodes };
};

const paintLook = (p) => {
  const key = JSON.stringify([p.theme, p.background, p.cardColor, p.textColor, p.titleColor, p.accent, p.radius, p.shadow, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  scene.dataset.theme = p.theme;
  s.setProperty('--cg-custom-bg', p.background);
  s.setProperty('--cg-custom-card', p.cardColor);
  s.setProperty('--cg-custom-ink', p.textColor);
  s.setProperty('--cg-custom-title', p.titleColor);
  s.setProperty('--cg-accent', p.accent);
  s.setProperty('--cg-radius', String(p.radius));
  s.setProperty('--cg-shadow', String(p.shadow));
  s.setProperty('--cg-font', fontOf(p.font));
  s.setProperty('--cg-size', String(p.fontSize));
  s.setProperty('--cg-weight', String(p.fontWeight));
  s.setProperty('--cg-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = titleWords(p.title);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const node = element('span', 'cg-word', (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : ''));
    headline.appendChild(node);
    return node;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const size = sizeOf();
  const rise = RISE * Math.min(size.width, size.height);
  paintLook(p);
  buildCards(p, size);
  const words = paintTitle(p);
  const layout = cache.nodes.length ? gridLayout(p, size, cache.heights) : { columns: [], heights: [], margin: 0, cardWidth: 0 };
  const f = gridFrame(layout, p, t, duration, size);

  f.cards.forEach((c, i) => {
    const card = cache.nodes[i];
    const s = card.node.style;
    s.transform = 'translate3d(' + c.x + 'px, ' + (c.y + c.rise * rise) + 'px, 0)';
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 && c.y + c.h > 0 && c.y < size.height ? 'visible' : 'hidden';
    seekVideo(card.video, t);
  });
  grid.style.filter = f.blur > 0.01 ? 'blur(' + f.blur + 'px)' : 'none';
  veil.style.opacity = String(f.veil);
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
