export const STRIP_VIEW = String.raw`
const LINK = /^(https?:|data:|blob:|\/)/;

const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim());
const mediaList = (raw) => (Array.isArray(raw) ? raw.filter((m) => m.kind !== 'video').map((m) => m.src) : listOf(raw).filter(Boolean).map((id) => (LINK.test(id) ? id : assets[id]))).filter(Boolean);

root.insertAdjacentHTML('beforeend', '<div class="ps"><div class="ps-row"></div><div class="ps-row ps-over"><div class="ps-caption"></div><div class="ps-cursor"></div></div></div>');

const scene = root.querySelector('.ps');
const row = root.querySelector('.ps-row');
const caption = root.querySelector('.ps-caption');
const pointer = root.querySelector('.ps-cursor');

let cache = { cardsKey: '', cards: [], lookKey: '', items: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const withMedia = (p) => {
  const items = mediaList(p.media);
  return { ...p, items, count: items.length || p.count };
};

const buildCards = (p, slots) => {
  const key = JSON.stringify([p.items, p.count, slots]);
  if (key === cache.cardsKey) {
    return cache.cards;
  }
  row.innerHTML = '';
  const cards = Array.from({ length: slots }, (_, slot) => {
    const node = document.createElement('div');
    node.className = 'ps-card';
    const src = p.items.length ? p.items[slot % p.items.length] : null;
    node.innerHTML = src ? '<img decoding="sync" draggable="false" src="' + src + '">' : '';
    row.appendChild(node);
    return node;
  });
  cache = { ...cache, cardsKey: key, cards };
  return cards;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.captionColor, p.placeholderColor, p.font, p.captionSize, p.captionWeight, p.tracking, p.radius, p.shadow, p.cursorColor]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ps-bg', p.background);
  s.setProperty('--ps-ink', p.captionColor);
  s.setProperty('--ps-empty', p.placeholderColor);
  s.setProperty('--ps-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--ps-size', String(p.captionSize));
  s.setProperty('--ps-weight', String(p.captionWeight));
  s.setProperty('--ps-tracking', p.tracking + 'em');
  s.setProperty('--ps-radius', p.radius + '%');
  s.setProperty('--ps-shadow', String(p.shadow));
  s.setProperty('--ps-cursor', p.cursorColor);
};

const words = (p, i) => {
  const label = listOf(p.captions)[i] || '';
  return p.lowercase ? label.toLowerCase() : label;
};

const draw = () => {
  const p = withMedia({ ...props });
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const f = stripFrame(p, t, duration, width, height);
  const cards = buildCards(p, f.cards.length);
  paintLook(p);

  f.cards.forEach((c, i) => {
    const s = cards[i].style;
    const half = width / unit / 2 + c.w * c.scale;
    s.width = c.w * unit + 'px';
    s.height = c.h * unit + 'px';
    s.transform = 'translate(-50%, -50%) translate(' + c.x * unit + 'px, ' + c.y * unit + 'px) scale(' + c.scale + ')';
    s.zIndex = String(c.z);
    s.visibility = Math.abs(c.x) < half ? 'visible' : 'hidden';
    s.setProperty('--ps-lift', String(c.lift));
  });

  caption.textContent = words(p, f.caption.photo);
  caption.style.opacity = String(f.caption.opacity);
  caption.style.transform = 'translate(-50%, 0) translate(' + f.caption.x * unit + 'px, ' + (f.caption.y + 0.012 * (1 - f.caption.opacity)) * unit + 'px)';

  pointer.style.opacity = String(f.cursor.opacity * 0.9);
  pointer.style.transform = 'translate(-50%, -50%) translate(' + f.cursor.x * unit + 'px, ' + f.cursor.y * unit + 'px) scale(' + (1 - 0.18 * f.cursor.press) + ')';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
