import { MEDIA_LIST } from '../media-list';

export const CLOUD_VIEW = String.raw`
${MEDIA_LIST}
const BLUR_BASE = 1080;
const TITLE_PAD = 0.03;

root.insertAdjacentHTML('beforeend', '<div class="mc"><div class="mc-world"></div><div class="mc-title"><h1 class="mc-headline"></h1></div></div>');

const scene = root.querySelector('.mc');
const world = root.querySelector('.mc-world');
const headline = root.querySelector('.mc-headline');

let cache = { layoutKey: '', layout: [], tilesKey: '', tiles: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.count, p.tileSize, p.spread, p.centreBoost]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: cloudLayout(p, width, height), tilesKey: '' };
  }
  return cache.layout;
};

const tileHtml = (item, crop) => {
  if (!item) {
    return '';
  }
  const at = ' style="object-position: ' + crop[0] + '% ' + crop[1] + '%"';
  return item.video ? '<video muted playsinline preload="auto"' + at + ' src="' + item.src + '"></video>' : '<img decoding="sync"' + at + ' src="' + item.src + '">';
};

const buildTiles = (p, layout) => {
  const key = JSON.stringify([p.media, layout.length]);
  if (key === cache.tilesKey) {
    return cache.tiles;
  }
  const items = mediaList(p.media);
  world.innerHTML = '';
  const tiles = layout.map((tile, i) => {
    const node = document.createElement('div');
    node.className = 'mc-tile';
    node.innerHTML = tileHtml(items.length ? items[i % items.length] : null, tile.crop);
    world.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
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
  s.setProperty('--mc-bg', p.background);
  s.setProperty('--mc-ink', p.titleColor);
  s.setProperty('--mc-empty', p.placeholderColor);
  s.setProperty('--mc-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--mc-size', String(p.fontSize));
  s.setProperty('--mc-weight', String(p.fontWeight));
  s.setProperty('--mc-tracking', p.tracking + 'em');
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
    span.className = 'mc-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(span);
    return span;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const titleBox = (unit) => ({ hw: headline.offsetWidth / 2 / unit + TITLE_PAD, hh: headline.offsetHeight / 2 / unit + TITLE_PAD });

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const box = frameBox(width, height);
  const layout = layoutFor(p);
  const tiles = buildTiles(p, layout);
  const words = paintTitle(p);
  paintLook(p);
  const f = cloudFrame(layout, p, t, duration, titleBox(unit));

  f.tiles.forEach((c, i) => {
    const s = tiles[i].node.style;
    const w = c.w * c.scale;
    const h = c.h * c.scale;
    const shown = c.opacity > 0.002 && Math.abs(c.x) - w / 2 < box.ax && Math.abs(c.y) - h / 2 < box.ay;
    s.visibility = shown ? 'visible' : 'hidden';
    if (!shown) {
      return;
    }
    s.width = w * unit + 'px';
    s.height = h * unit + 'px';
    s.transform = 'translate(' + ((c.x - w / 2) * unit) + 'px, ' + ((c.y - h / 2) * unit) + 'px)';
    s.opacity = String(c.opacity);
    s.zIndex = String(c.z);
    s.filter = c.blur > 0.05 ? 'blur(' + (c.blur * unit) / BLUR_BASE + 'px)' : 'none';
    seekVideo(tiles[i].video, t);
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
