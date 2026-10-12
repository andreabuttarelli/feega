import { MEDIA_LIST } from '../media-list';

export const GRID_VIEW = String.raw`
${MEDIA_LIST}
const STROKE = 0.012;

root.insertAdjacentHTML('beforeend', '<div class="gw"></div>');

const scene = root.querySelector('.gw');

let cache = { itemsKey: '', nodes: [], lookKey: '', gridKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const mediaHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" draggable="false" src="' + item.src + '">';
};

const buildItems = (p, items) => {
  const key = JSON.stringify([p.media, p.lowercase, items.map((c) => [c.kind, c.text, c.media])]);
  if (key === cache.itemsKey) {
    return cache.nodes;
  }
  const list = mediaList(p.media);
  scene.innerHTML = '';
  const nodes = items.map((c) => {
    const node = document.createElement('div');
    node.className = c.kind === 'media' ? 'gw-media' : 'gw-chip';
    if (c.kind === 'media') {
      node.innerHTML = mediaHtml(list.length ? list[c.media % list.length] : null);
    } else {
      const word = document.createElement('span');
      word.className = 'gw-word';
      word.textContent = p.lowercase ? c.text.toLowerCase() : c.text;
      node.appendChild(word);
    }
    scene.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, inner: node.firstElementChild, video };
  });
  cache = { ...cache, itemsKey: key, nodes };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.lineColor, p.chipColor, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--gw-bg', p.background);
  s.setProperty('--gw-line', p.lineColor);
  s.setProperty('--gw-chip', p.chipColor);
  s.setProperty('--gw-ink', p.textColor);
  s.setProperty('--gw-empty', p.placeholderColor);
  s.setProperty('--gw-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", Georgia, "Times New Roman", serif');
  s.setProperty('--gw-weight', String(p.fontWeight));
  s.setProperty('--gw-tracking', p.tracking + 'em');
};

const paintGrid = (f) => {
  const key = [f.cell, f.ox, f.oy].join();
  if (key === cache.gridKey) {
    return;
  }
  cache = { ...cache, gridKey: key };
  const s = scene.style;
  s.setProperty('--gw-stroke', Math.max(1, f.cell * STROKE) + 'px');
  s.backgroundSize = f.cell + 'px ' + f.cell + 'px';
  s.backgroundPosition = f.ox + 'px ' + f.oy + 'px';
};

const box = (s, c) => {
  s.left = c.x + 'px';
  s.top = c.y + 'px';
  s.width = c.w + 'px';
  s.height = c.h + 'px';
  s.opacity = String(c.fade);
};

const paintWord = (cell, c) => {
  const s = cell.node.style;
  box(s, c);
  s.clipPath = 'inset(0 ' + (1 - c.chip) * 100 + '% 0 0)';
  s.visibility = c.chip > 0.002 && c.fade > 0.002 ? 'visible' : 'hidden';
  const w = cell.inner.style;
  w.fontSize = c.size + 'px';
  w.opacity = String(c.ink);
  w.transform = 'translate3d(0, ' + c.rise + 'em, 0)';
};

const paintMedia = (cell, c, t) => {
  const s = cell.node.style;
  box(s, c);
  s.clipPath = 'inset(' + (1 - c.reveal) * 50 + '% ' + (1 - c.reveal) * 50 + '%)';
  s.visibility = c.reveal > 0.002 && c.fade > 0.002 ? 'visible' : 'hidden';
  if (cell.inner) {
    cell.inner.style.transform = 'scale(' + c.zoom + ')';
  }
  seekVideo(cell.video, t);
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const f = gridFrame(p, t, duration, width, height);
  const nodes = buildItems(p, f.items);
  paintLook(p);
  paintGrid(f);
  f.items.forEach((c, i) => (c.kind === 'media' ? paintMedia(nodes[i], c, t) : paintWord(nodes[i], c)));
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
