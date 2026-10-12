import { MEDIA_LIST } from '../media-list';

export const ROWS_VIEW = String.raw`
${MEDIA_LIST}
const FIT = 0.9;

root.insertAdjacentHTML('beforeend', '<div class="rst"><div class="rst-row"></div><div class="rst-row"></div><div class="rst-title"></div></div>');

const scene = root.querySelector('.rst');
const rowNodes = [...root.querySelectorAll('.rst-row')];
const headline = root.querySelector('.rst-title');

let cache = { cardsKey: '', rows: [[], []], lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontOf = (font) => (String(font).includes(',') ? font : '"' + font + '", system-ui, sans-serif');
const titleWords = (raw) => String(raw || '').split(/\s+/).filter(Boolean);

const cardNode = (item) => {
  const node = document.createElement('div');
  node.className = 'rst-card';
  if (!item) {
    return { node, video: null };
  }
  const media = document.createElement(item.video ? 'video' : 'img');
  media.src = item.src;
  if (item.video) {
    media.muted = true;
    media.playsInline = true;
    media.preload = 'auto';
    media.addEventListener('loadedmetadata', () => seekVideo(media, tl.time()));
  } else {
    media.decoding = 'sync';
    media.draggable = false;
  }
  node.appendChild(media);
  return { node, video: item.video ? media : null };
};

const buildRows = (rows, items) => {
  const key = JSON.stringify([items, rows.map((r) => r.cards.map((c) => c.photo))]);
  if (key === cache.cardsKey) {
    return cache.rows;
  }
  const built = rows.map((r, i) => {
    rowNodes[i].innerHTML = '';
    return r.cards.map((c) => {
      const card = cardNode(items[c.photo]);
      rowNodes[i].appendChild(card.node);
      return card;
    });
  });
  cache = { ...cache, cardsKey: key, rows: built };
  return built;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.placeholderColor, p.font, p.fontSize, p.fontWeight, p.tracking, p.radius]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--rst-bg', p.background);
  s.setProperty('--rst-ink', p.titleColor);
  s.setProperty('--rst-empty', p.placeholderColor);
  s.setProperty('--rst-font', fontOf(p.font));
  s.setProperty('--rst-size', String(p.fontSize));
  s.setProperty('--rst-weight', String(p.fontWeight));
  s.setProperty('--rst-tracking', p.tracking + 'em');
  s.setProperty('--rst-radius', p.radius + '%');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  headline.innerHTML = '';
  const nodes = titleWords(p.title).map((word) => {
    const node = document.createElement('span');
    node.className = 'rst-word';
    node.textContent = p.lowercase ? word.toLowerCase() : word;
    headline.appendChild(node);
    return node;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const items = mediaList(p.media);
  paintLook(p);

  const rows = rowsFrame(p, t, duration, width, height, items.length);
  const built = buildRows(rows, items);
  rows.forEach((r, i) => {
    r.cards.forEach((c, j) => {
      const s = built[i][j].node.style;
      s.width = c.w * unit + 'px';
      s.height = c.w * unit + 'px';
      s.transform = 'translate3d(' + (c.x - c.w / 2) * unit + 'px, ' + (r.y - c.w / 2) * unit + 'px, 0)';
      s.visibility = Math.abs(c.x) - c.w / 2 < width / unit / 2 ? 'visible' : 'hidden';
      seekVideo(built[i][j].video, t);
    });
  });

  const words = paintTitle(p);
  const f = titleFrame(p, t, duration, words.length);
  headline.style.gap = f.gap * unit + 'px';
  headline.style.transform = 'translate(-50%, -50%)';
  const fit = Math.min(1, (FIT * width) / Math.max(1, headline.offsetWidth));
  headline.style.transform = 'translate(-50%, -50%) scale(' + fit + ')';
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.rise + 'em, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
