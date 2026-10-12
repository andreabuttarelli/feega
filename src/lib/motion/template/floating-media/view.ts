export const FLOAT_VIEW = String.raw`
const VIDEO_MARK = 'video:';
const LINK = /^(https?:|data:|blob:|\/)/;
const BLUR_UNIT = 0.0012;
const BORDER_BASE = 1080;

const picked = (item) => ({ src: item.src, video: item.kind === 'video' });

const mediaList = (raw) => Array.isArray(raw) ? raw.map(picked).filter((m) => m.src) : String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
  const video = item.startsWith(VIDEO_MARK);
  const id = video ? item.slice(VIDEO_MARK.length).trim() : item;
  const src = LINK.test(id) ? id : assets[id];
  return src ? { src, video } : null;
}).filter(Boolean);

root.insertAdjacentHTML('beforeend', '<div class="fm"><div class="fm-world"></div><div class="fm-title"><h1 class="fm-headline"></h1><div class="fm-sub"></div></div></div>');

const scene = root.querySelector('.fm');
const world = root.querySelector('.fm-world');
const headline = root.querySelector('.fm-headline');
const sub = root.querySelector('.fm-sub');

let cache = { layoutKey: '', layout: [], cardsKey: '', cards: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.count, p.layout, p.depth, p.drift, p.cardSize, p.safeWidth, p.safeHeight]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: floatLayout(p, width, height) };
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
    node.className = 'fm-card';
    node.innerHTML = cardHtml(items.length ? items[i % items.length] : null) + '<i class="fm-shade"></i>';
    world.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, shade: node.querySelector('.fm-shade'), video };
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.subtitleColor, p.placeholderColor, p.font, p.fontSize, p.fontWeight, p.tracking, p.radius, p.border, p.borderColor, p.shadow]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  const { width, height } = sizeOf();
  s.setProperty('--fm-bg', p.background);
  s.setProperty('--fm-ink', p.titleColor);
  s.setProperty('--fm-sub', p.subtitleColor);
  s.setProperty('--fm-empty', p.placeholderColor);
  s.setProperty('--fm-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--fm-size', String(p.fontSize));
  s.setProperty('--fm-weight', String(p.fontWeight));
  s.setProperty('--fm-tracking', p.tracking + 'em');
  s.setProperty('--fm-radius', p.radius + '%');
  s.setProperty('--fm-border', (p.border * Math.min(width, height)) / BORDER_BASE + 'px');
  s.setProperty('--fm-border-color', p.borderColor);
  s.setProperty('--fm-shadow', String(p.shadow));
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.subtitle, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = String(p.title || '').trim().split(/\s+/).filter(Boolean);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'fm-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(span);
    return span;
  });
  sub.textContent = p.subtitle;
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const seekVideo = (video, t) => {
  if (!video || !(video.duration > 0)) {
    return;
  }
  const at = t % video.duration;
  if (Math.abs(video.currentTime - at) > 0.5 / fps) {
    video.currentTime = at;
  }
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
  const f = floatFrame(layout, p, t, duration);

  scene.style.perspective = PERSPECTIVE * unit + 'px';
  f.cards.forEach((c, i) => {
    const card = cards[i];
    const s = card.node.style;
    s.width = c.w * unit + 'px';
    s.height = c.h * unit + 'px';
    s.transform = 'translate(-50%, -50%) translate3d(' + c.x * unit + 'px, ' + c.y * unit + 'px, ' + c.z * unit + 'px) rotateX(' + c.rx + 'deg) rotateY(' + c.ry + 'deg) rotateZ(' + c.rz + 'deg)';
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
    s.filter = c.blur > 0.01 ? 'blur(' + c.blur * BLUR_UNIT * unit + 'px)' : 'none';
    card.shade.style.opacity = String(c.dim);
    seekVideo(card.video, t);
  });
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translateY(' + w.y + 'em)';
    s.filter = w.blur > 0.002 ? 'blur(' + w.blur + 'em)' : 'none';
  });
  sub.style.opacity = String(f.subtitle);
  sub.style.transform = 'translateY(' + 0.4 * (1 - f.subtitle) + 'em)';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
