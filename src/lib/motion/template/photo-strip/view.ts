export const STRIP_VIEW = String.raw`
const LINK = /^(https?:|data:|blob:|\/)/;
const GLIDE = 0.7;
const WHEEL_IDLE = 0.18;
const WHEEL_UNIT = 0.004;
const SAMPLE_WINDOW = 0.1;

const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim());
const mediaList = (raw) => listOf(raw).filter(Boolean).map((id) => (LINK.test(id) ? id : assets[id])).filter(Boolean);

root.insertAdjacentHTML('beforeend', '<div class="ps"><div class="ps-row"></div><div class="ps-row ps-over"><div class="ps-caption"></div><div class="ps-cursor"></div></div></div>');

const scene = root.querySelector('.ps');
const row = root.querySelector('.ps-row');
const caption = root.querySelector('.ps-caption');
const pointer = root.querySelector('.ps-cursor');

let cache = { cardsKey: '', cards: [], lookKey: '', items: [] };
let hand = { shift: 0, offset: 0, holding: false, glide: null, from: 0, startX: 0, samples: [], wheelAt: -1, drag: 0, tau: 0 };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const withMedia = (p) => {
  const items = mediaList(p.media);
  return { ...p, items, count: items.length || p.count };
};

const buildCards = (p, slots) => {
  const key = JSON.stringify([p.media, p.count, slots]);
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
  const key = JSON.stringify([p.background, p.captionColor, p.placeholderColor, p.font, p.captionSize, p.captionWeight, p.tracking, p.radius, p.shadow, p.cursorColor, p.drag]);
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
  scene.toggleAttribute('data-drag', Boolean(p.drag));
};

const autoPos = (plan, t) => stripPos(plan, t - hand.shift) + hand.offset;

const glideAt = (t) => {
  const g = hand.glide;
  const x = t < g.at ? 1 : Math.min(1, (t - g.at) / GLIDE);
  return { pos: g.from + (g.to - g.from) * flick(x), x };
};

const handBack = (plan, t) => {
  const rest = restAfter(plan, hand.glide.tau);
  hand = { ...hand, glide: null, shift: t - rest.at, offset: hand.glide.to - rest.pos };
};

const handPos = (plan, t) => {
  if (hand.holding) {
    return { pos: hand.from + hand.drag, calm: 0 };
  }
  if (!hand.glide) {
    return null;
  }
  const g = glideAt(t);
  if (g.x < 1) {
    return { pos: g.pos, calm: smooth(Math.max(0, (g.x - 0.6) / 0.4)) };
  }
  handBack(plan, t);
  return null;
};

const cardsPerPx = (p) => {
  const { width, height } = sizeOf();
  return 1 / (pitchOf(p) * Math.min(width, height));
};

let current = { p: null, plan: null, pos: 0 };

const grab = (x) => {
  const t = tl.time();
  hand = { ...hand, holding: true, glide: null, from: current.pos, drag: 0, startX: x, samples: [{ t, drag: 0 }], tau: t - hand.shift };
  scene.toggleAttribute('data-holding', true);
};

const pull = (x, t) => {
  const drag = (hand.startX - x) * cardsPerPx(current.p);
  hand = { ...hand, drag, samples: [...hand.samples.filter((s) => t - s.t < SAMPLE_WINDOW), { t, drag }] };
  draw();
};

const release = () => {
  const t = tl.time();
  const first = hand.samples[0];
  const last = hand.samples[hand.samples.length - 1];
  const velocity = last.t > first.t ? (last.drag - first.drag) / (last.t - first.t) : 0;
  const from = hand.from + hand.drag;
  hand = { ...hand, holding: false, glide: { at: t, from, to: releaseTarget(from, velocity), tau: hand.tau }, wheelAt: -1 };
  scene.toggleAttribute('data-holding', false);
};

scene.addEventListener('pointerdown', (e) => {
  if (!current.p || !current.p.drag) {
    return;
  }
  scene.setPointerCapture?.(e.pointerId);
  grab(e.clientX);
});
scene.addEventListener('pointermove', (e) => {
  if (hand.holding && hand.wheelAt < 0) {
    pull(e.clientX, tl.time());
  }
});
scene.addEventListener('pointerup', () => hand.holding && hand.wheelAt < 0 && release());
scene.addEventListener('pointercancel', () => hand.holding && hand.wheelAt < 0 && release());
scene.addEventListener('wheel', (e) => {
  if (!current.p || !current.p.drag) {
    return;
  }
  e.preventDefault();
  const t = tl.time();
  if (!hand.holding) {
    grab(0);
  }
  const step = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * WHEEL_UNIT;
  hand = { ...hand, wheelAt: t };
  pull(hand.startX - (hand.drag + step) / cardsPerPx(current.p), t);
}, { passive: false });

const wheelDone = (t) => hand.holding && hand.wheelAt >= 0 && (t - hand.wheelAt > WHEEL_IDLE || t < hand.wheelAt);

const words = (p, i) => {
  const label = listOf(p.captions)[i] || '';
  return p.lowercase ? label.toLowerCase() : label;
};

const draw = () => {
  const p = withMedia({ ...props });
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  if (wheelDone(t)) {
    release();
  }
  const plan = stripPlan(p, duration);
  const held = p.drag ? handPos(plan, t) : null;
  const pos = held ? held.pos : autoPos(plan, t);
  current = { p, plan, pos };
  const f = stripFrame(p, t - hand.shift, duration, width, height, pos, held ? held.calm : undefined);
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
