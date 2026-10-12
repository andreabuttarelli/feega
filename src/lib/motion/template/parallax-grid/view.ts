import { MEDIA_LIST } from '../media-list';

export const PGRID_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="pg"><div class="pg-grid"></div><i class="pg-veil"></i><div class="pg-title"><h1 class="pg-headline"></h1></div></div>');

const scene = root.querySelector('.pg');
const grid = root.querySelector('.pg-grid');
const veil = root.querySelector('.pg-veil');
const headline = root.querySelector('.pg-headline');

let cache = { layoutKey: '', layout: [], tilesKey: '', tiles: [], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const layoutFor = (p, aspect) => {
  const key = JSON.stringify([p.motion, p.columns, p.gap, p.tileAspect, p.speed, p.spread, aspect]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: gridLayout(p, aspect) };
  }
  return cache.layout;
};

const tileHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const buildTiles = (p, layout) => {
  const key = JSON.stringify([p.media, layout.map((c) => c.n)]);
  if (key === cache.tilesKey) {
    return cache.tiles;
  }
  const items = mediaList(p.media);
  grid.innerHTML = '';
  const pick = (i, j) => {
    const k = j + Math.round(i * items.length * GOLDEN);
    return items[(i % 2 ? items.length - 1 - (k % items.length) : k) % items.length];
  };
  const tiles = layout.map((c, i) => Array.from({ length: c.n }, (_, j) => {
    const node = document.createElement('div');
    node.className = 'pg-tile';
    node.innerHTML = tileHtml(items.length ? pick(i, j) : null);
    grid.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
  }));
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
  s.setProperty('--pg-bg', p.background);
  s.setProperty('--pg-ink', p.titleColor);
  s.setProperty('--pg-empty', p.placeholderColor);
  s.setProperty('--pg-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--pg-size', String(p.fontSize));
  s.setProperty('--pg-weight', String(p.fontWeight));
  s.setProperty('--pg-tracking', p.tracking + 'em');
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
    span.className = 'pg-word';
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
  const layout = layoutFor(p, height / width);
  const tiles = buildTiles(p, layout);
  const words = paintTitle(p);
  paintLook(p);
  const f = gridFrame(layout, p, t, duration);

  grid.style.transform = 'scale(' + f.scale + ')';
  f.columns.forEach((c, i) => {
    const col = layout[i];
    c.tiles.forEach((tile, j) => {
      const s = tiles[i][j].node.style;
      s.width = col.w * width + 'px';
      s.height = col.tileH * width + 'px';
      s.transform = 'translate3d(' + col.x * width + 'px, ' + tile.y * width + 'px, 0)';
      seekVideo(tiles[i][j].video, t);
    });
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
