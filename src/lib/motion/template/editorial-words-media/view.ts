import { MEDIA_LIST } from '../media-list';

export const EDITORIAL_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="ew"></div>');

const scene = root.querySelector('.ew');

let cache = { cellsKey: '', nodes: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const mediaHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" draggable="false" src="' + item.src + '">';
};

const buildCells = (p, cells) => {
  const key = JSON.stringify([p.media, p.lowercase, cells.map((c) => [c.kind, c.text])]);
  if (key === cache.cellsKey) {
    return cache.nodes;
  }
  const items = mediaList(p.media);
  scene.innerHTML = '';
  const nodes = cells.map((c) => {
    const node = document.createElement('div');
    node.className = c.kind === 'media' ? 'ew-media' : 'ew-text';
    if (c.kind === 'media') {
      node.innerHTML = mediaHtml(items.length ? items[c.media % items.length] : null);
    } else {
      node.textContent = p.lowercase ? c.text.toLowerCase() : c.text;
    }
    scene.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, inner: node.firstElementChild, video };
  });
  cache = { ...cache, cellsKey: key, nodes };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ew-bg', p.background);
  s.setProperty('--ew-ink', p.textColor);
  s.setProperty('--ew-empty', p.placeholderColor);
  s.setProperty('--ew-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
  s.setProperty('--ew-weight', String(p.fontWeight));
  s.setProperty('--ew-tracking', p.tracking + 'em');
};

const paintText = (s, c) => {
  s.fontSize = c.size + 'px';
  s.top = c.y + 'px';
  s.left = c.align === 'left' ? c.x + 'px' : 'auto';
  s.right = c.align === 'left' ? 'auto' : sizeOf().width - c.x + 'px';
  s.opacity = String(c.opacity);
  s.transform = 'translate3d(0, ' + c.rise + 'em, 0)';
  s.visibility = c.opacity > 0.002 ? 'visible' : 'hidden';
};

const paintMedia = (cell, c, t) => {
  const s = cell.node.style;
  s.left = c.x + 'px';
  s.top = c.y + 'px';
  s.width = c.w + 'px';
  s.height = c.h + 'px';
  s.clipPath = 'inset(' + (1 - c.reveal) * 50 + '% ' + (1 - c.reveal) * 50 + '%)';
  s.visibility = c.reveal > 0.002 ? 'visible' : 'hidden';
  if (cell.inner) {
    cell.inner.style.transform = 'scale(' + c.zoom + ')';
  }
  seekVideo(cell.video, t);
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const f = editorialFrame(p, t, duration, width, height);
  const nodes = buildCells(p, f.cells);
  paintLook(p);
  f.cells.forEach((c, i) => {
    if (c.kind === 'media') {
      paintMedia(nodes[i], c, t);
      return;
    }
    paintText(nodes[i].node.style, c);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
