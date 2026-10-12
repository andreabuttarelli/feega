import { MEDIA_LIST } from '../media-list';

export const GLOBE_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="ig"><div class="ig-globe"></div><i class="ig-veil"></i><div class="ig-title"><h1 class="ig-headline"></h1></div></div>');

const scene = root.querySelector('.ig');
const globe = root.querySelector('.ig-globe');
const veil = root.querySelector('.ig-veil');
const headline = root.querySelector('.ig-headline');

let cache = { layoutKey: '', layout: [], tilesKey: '', tiles: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.tiles, p.tileSize, p.tileAspect, p.radius]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: globeLayout(p) };
  }
  return cache.layout;
};

const tileHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const buildTiles = (p, n) => {
  const key = JSON.stringify([p.media, n]);
  if (key === cache.tilesKey) {
    return cache.tiles;
  }
  const items = mediaList(p.media);
  globe.innerHTML = '';
  const tiles = Array.from({ length: n }, (_, i) => {
    const node = document.createElement('div');
    node.className = 'ig-tile';
    node.innerHTML = tileHtml(items.length ? items[i % items.length] : null) + '<i class="ig-shade"></i>';
    globe.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, shade: node.querySelector('.ig-shade'), video };
  });
  cache = { ...cache, tilesKey: key, tiles };
  return tiles;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.placeholderColor, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ig-bg', p.background);
  s.setProperty('--ig-ink', p.titleColor);
  s.setProperty('--ig-empty', p.placeholderColor);
  s.setProperty('--ig-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--ig-size', String(p.fontSize));
  s.setProperty('--ig-weight', String(p.fontWeight));
  s.setProperty('--ig-tracking', p.tracking + 'em');
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
    span.className = 'ig-word';
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
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const layout = layoutFor(p);
  const tiles = buildTiles(p, layout.length);
  const words = paintTitle(p);
  paintLook(p);
  const f = globeFrame(layout, p, t, duration);

  scene.style.perspective = PERSPECTIVE * unit + 'px';
  globe.style.transform = 'scale3d(' + f.scale + ', ' + f.scale + ', ' + f.scale + ') rotateX(' + f.tilt + 'rad)';
  f.tiles.forEach((c, i) => {
    const tile = tiles[i];
    const s = tile.node.style;
    s.width = c.w * unit + 'px';
    s.height = c.h * unit + 'px';
    s.transform = 'translate(-50%, -50%) rotateY(' + c.lon + 'rad) rotateX(' + c.lat + 'rad) translateZ(' + c.r * unit + 'px)';
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
    tile.shade.style.opacity = String(c.shade);
    seekVideo(tile.video, t);
  });
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
