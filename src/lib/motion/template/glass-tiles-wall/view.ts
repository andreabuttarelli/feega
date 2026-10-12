import { MEDIA_LIST } from '../media-list';

export const GTW_VIEW = String.raw`
${MEDIA_LIST}
const SHEEN_TRAVEL = 120;
const SHADE_DEPTH = 0.75;

root.insertAdjacentHTML('beforeend', '<div class="gt"><div class="gt-wall"></div><i class="gt-vignette"></i></div>');

const scene = root.querySelector('.gt');
const wall = root.querySelector('.gt-wall');

let cache = { layoutKey: '', layout: null, tilesKey: '', tiles: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const listOf = (raw, mark) => String(raw || '').split(mark).map((s) => s.trim()).filter(Boolean);
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.tileSize, p.tileAspect, p.gap, p.curve, p.moves, p.step]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: wallLayout(p, width, height), tilesKey: '' };
  }
  return cache.layout;
};

const mediaHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const rimHtml = (item) => (item && !item.video ? '<img decoding="sync" src="' + item.src + '">' : '');

const tileHtml = (p, item, title, caption, n) => '<div class="gt-rim">' + rimHtml(item) + '</div>'
  + '<div class="gt-face">' + mediaHtml(item) + '<i class="gt-dim"></i>'
  + '<div class="gt-meta"><span>' + escapeHtml(p.label) + '</span><span>' + String(n).padStart(2, '0') + ' / ' + escapeHtml(p.label) + '</span></div>'
  + '<i class="gt-rule"></i><div class="gt-text"><h3 class="gt-name">' + escapeHtml(title) + '</h3><p class="gt-cap">' + escapeHtml(caption) + '</p></div></div>'
  + '<i class="gt-gloss"><b></b></i><i class="gt-shade"></i>';

const buildTiles = (p, layout, frame) => {
  const key = JSON.stringify([p.media, p.titles, p.captions, p.label, layout.rows.map((r) => r.slots)]);
  if (key === cache.tilesKey) {
    return cache.tiles;
  }
  const items = mediaList(p.media);
  const titles = listOf(p.titles, ',');
  const captions = listOf(p.captions, '|');
  wall.innerHTML = '';
  const tiles = frame.tiles.map((tile) => {
    const node = document.createElement('div');
    node.className = 'gt-tile';
    const at = (list) => (list.length ? list[tile.item % list.length] : '');
    node.innerHTML = tileHtml(p, items.length ? items[tile.item % items.length] : null, at(titles), at(captions), (tile.item % Math.max(1, titles.length)) + 1);
    wall.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video, gloss: node.querySelector('.gt-gloss b'), shade: node.querySelector('.gt-shade') };
  });
  cache = { ...cache, tilesKey: key, tiles };
  return tiles;
};

const paintLook = (p, layout) => {
  const key = JSON.stringify([p.background, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking, p.roundness, p.glass, layout.tileW, layout.tileH, layout.distance]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--gt-bg', p.background);
  s.setProperty('--gt-ink', p.textColor);
  s.setProperty('--gt-empty', p.placeholderColor);
  s.setProperty('--gt-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--gt-weight', String(p.fontWeight));
  s.setProperty('--gt-tracking', p.tracking + 'em');
  s.setProperty('--gt-w', layout.tileW + 'px');
  s.setProperty('--gt-h', layout.tileH + 'px');
  s.setProperty('--gt-radius', p.roundness * layout.tileW + 'px');
  s.setProperty('--gt-glass', String(p.glass));
  wall.style.perspective = layout.distance + 'px';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const layout = layoutFor(p);
  const f = wallFrame(layout, p, t, duration);
  const tiles = buildTiles(p, layout, f);
  paintLook(p, layout);

  f.tiles.forEach((c, i) => {
    const tile = tiles[i];
    const s = tile.node.style;
    s.visibility = c.shown ? 'visible' : 'hidden';
    if (!c.shown) {
      return;
    }
    s.transform = 'translate3d(' + c.x + 'px, ' + c.y + 'px, ' + c.z + 'px) rotateX(' + f.tilt + 'rad) rotateY(' + c.a + 'rad) rotateX(' + (-c.b) + 'rad)';
    s.zIndex = String(Math.round(c.z + layout.radius * 2));
    tile.gloss.style.transform = 'translate3d(' + (-c.a * SHEEN_TRAVEL) + '%, ' + (-c.b * SHEEN_TRAVEL * 0.5) + '%, 0)';
    tile.shade.style.opacity = String(SHADE_DEPTH * (1 - c.facing));
    seekVideo(tile.video, t);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
