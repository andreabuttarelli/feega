import { MEDIA_LIST } from '../media-list';

export const COLLAGE_VIEW = String.raw`
${MEDIA_LIST}
root.insertAdjacentHTML('beforeend', '<div class="cs"><div class="cs-letters"><div class="cs-lines"></div></div><div class="cs-world"></div><div class="cs-grid"></div></div>');

const scene = root.querySelector('.cs');
const block = root.querySelector('.cs-lines');
const world = root.querySelector('.cs-world');
const grid = root.querySelector('.cs-grid');
const STRIP_SPARE = 2;

let cache = { layoutKey: '', layout: null, cardsKey: '', cards: [], gridKey: '', lines: [], cells: [], lookKey: '', textKey: '', strips: [], fit: null };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.count, p.cardScale]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: collageLayout(p, width, height) };
  }
  return cache.layout;
};

const cardHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const buildCards = (p, layout) => {
  const key = JSON.stringify([p.media, layout.cards.length]);
  if (key === cache.cardsKey) {
    return cache.cards;
  }
  const items = mediaList(p.media);
  world.innerHTML = '';
  const cards = layout.cards.map((card, i) => {
    const node = document.createElement('div');
    node.className = card.print ? 'cs-card cs-print' : 'cs-card';
    node.innerHTML = cardHtml(items.length ? items[i % items.length] : null);
    world.appendChild(node);
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const buildGrid = (p, layout) => {
  const key = JSON.stringify([p.labels, layout.cells.length]);
  if (key === cache.gridKey) {
    return;
  }
  grid.innerHTML = '';
  const lines = layout.lines.map((y) => {
    const node = document.createElement('div');
    node.className = 'cs-line';
    node.style.top = y * 100 + '%';
    grid.appendChild(node);
    return node;
  });
  const rows = labelRows(p.labels, layout.cells.length);
  const cells = layout.cells.map((cell, k) => {
    const node = document.createElement('p');
    node.className = 'cs-cell';
    node.style.left = cell.x * 100 + '%';
    node.style.top = cell.y * 100 + '%';
    node.textContent = rows[k].join('\n');
    grid.appendChild(node);
    return node;
  });
  cache = { ...cache, gridKey: key, lines, cells };
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.letterColor, p.paper, p.labelColor, p.placeholderColor, p.font, p.weight, p.outline]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--cs-bg', p.background);
  s.setProperty('--cs-letter', p.letterColor);
  s.setProperty('--cs-fill', p.outline ? 'transparent' : p.letterColor);
  s.setProperty('--cs-stroke', p.outline ? '0.035em' : '0');
  s.setProperty('--cs-paper', p.paper);
  s.setProperty('--cs-label', p.labelColor);
  s.setProperty('--cs-empty', p.placeholderColor);
  s.setProperty('--cs-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
  s.setProperty('--cs-weight', String(p.weight));
  s.setProperty('--cs-leading', String(LETTER_LEADING));
};

const buildText = (p, width, height) => {
  const fit = fitLetters(p.text, width, height, p.letterSize);
  const key = JSON.stringify([fit.lines, fit.size]);
  if (key !== cache.textKey) {
    block.innerHTML = '';
    block.style.setProperty('--cs-size', fit.size + 'px');
    const strips = fit.lines.map((line) => {
      const node = document.createElement('div');
      node.className = 'cs-strip';
      block.appendChild(node);
      return { node, line, copies: 0 };
    });
    cache = { ...cache, textKey: key, strips, fit };
  }
  return cache.fit;
};

const fillStrip = (strip, longSide) => {
  const first = strip.node.firstElementChild;
  const tile = first ? first.offsetWidth : 0;
  const copies = tile > 0 ? Math.ceil(longSide / tile) + STRIP_SPARE : 1;
  if (copies > strip.copies) {
    strip.node.innerHTML = Array.from({ length: copies }, () => '<span></span>').join('');
    strip.node.querySelectorAll('span').forEach((s) => (s.textContent = strip.line + ' '));
    strip.copies = copies;
  }
  return { tile: strip.node.firstElementChild.offsetWidth, copies: strip.copies };
};

const placeText = (fit, drift, longSide) => {
  block.style.transform = 'rotate(' + fit.turn + 'deg) translate3d(0, ' + -block.offsetHeight / 2 + 'px, 0)';
  cache.strips.forEach((strip, r) => {
    const { tile, copies } = fillStrip(strip, longSide);
    const way = r % 2 ? 1 : -1;
    const shift = -(tile * copies) / 2 + tile / 2 + way * drift * tile;
    strip.node.style.transform = 'translate3d(' + shift + 'px, 0, 0)';
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  paintLook(p);
  const layout = layoutFor(p);
  const cards = buildCards(p, layout);
  buildGrid(p, layout);
  const fit = buildText(p, width, height);
  const f = collageFrame(layout, p, t, duration);
  const u = layout.unit;

  placeText(fit, f.drift, Math.max(width, height));

  f.cards.forEach((c, i) => {
    const card = layout.cards[i];
    const s = cards[i].node.style;
    s.width = card.w * u + 'px';
    s.height = card.h * u + 'px';
    s.transform = 'translate3d(' + (c.x * u - (card.w * u) / 2) + 'px, ' + (c.y * u - (card.h * u) / 2) + 'px, 0) rotate(' + c.rot + 'deg) scale(' + c.scale + ')';
    s.visibility = c.opacity > 0 ? 'visible' : 'hidden';
    seekVideo(cards[i].video, t);
  });
  f.lines.forEach((reach, r) => {
    cache.lines[r].style.transform = 'scaleX(' + reach + ')';
  });
  f.cells.forEach((c, k) => {
    const s = cache.cells[k].style;
    s.opacity = String(c.opacity);
    s.transform = 'translate3d(0, ' + c.y + 'em, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
