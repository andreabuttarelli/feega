export const MARQUEE_VIEW = String.raw`
const LINK = /^(https?:|data:|blob:|\/)/;
const QUOTE_SPLIT = /\s+[—–-]\s+|\s*\|\s*/;
const MAX_FRAME = 0.1;
const HOVER_EASE = 0.25;
const SAMPLES = 8;

const WORD_LOOKS = [
  { family: 'Space Grotesk', weight: 600, glyph: '<circle cx="12" cy="12" r="10"/>' },
  { family: 'Instrument Serif', weight: 400, glyph: '' },
  { family: 'Manrope', weight: 800, glyph: '<rect x="2" y="2" width="20" height="20"/>' },
  { family: 'DM Sans', weight: 500, glyph: '<circle cx="8" cy="12" r="6"/><circle cx="16" cy="12" r="6" opacity="0.55"/>' },
  { family: 'Geist', weight: 700, glyph: '<path d="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zm0 5a5 5 0 1 1 0 10a5 5 0 1 1 0-10z" fill-rule="evenodd"/>' },
  { family: 'Inter Tight', weight: 600, glyph: '<rect x="2" y="2" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/>' }
];

const listOf = (raw, by) => String(raw || '').split(by).map((s) => s.trim()).filter(Boolean);
const mediaList = (raw) => (Array.isArray(raw) ? raw.filter((m) => m.kind !== 'video').map((m) => m.src) : listOf(raw, ',').map((id) => (LINK.test(id) ? id : assets[id]))).filter(Boolean);
const fontOf = (family) => (String(family).includes(',') ? family : '"' + family + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const initials = (name) => listOf(name.split(',')[0], ' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const rotated = (list, by) => list.map((_, i) => list[(i + by) % list.length]);

function quoteOf(line) {
  const parts = line.split(QUOTE_SPLIT);
  const name = parts.length > 1 ? parts.pop() : '';
  return { said: parts.join(' — '), name };
}

const CELL_HTML = {
  logo: (item, p) => (item.src ? (p.monochrome ? '<div class="mq-mono" style="--mq-src:url(&quot;' + escaped(item.src) + '&quot;)"></div>' : '<img decoding="sync" draggable="false" src="' + escaped(item.src) + '">') : wordHtml(item)),
  image: (item) => (item.src ? '<img decoding="sync" draggable="false" src="' + escaped(item.src) + '">' : ''),
  quote: (item) => '<div class="mq-said">' + escaped(item.said) + '</div>' + (item.name ? '<div class="mq-who"><i>' + escaped(initials(item.name)) + '</i><span>' + escaped(item.name) + '</span></div>' : '')
};

function wordHtml(item) {
  const look = WORD_LOOKS[item.look % WORD_LOOKS.length];
  const glyph = look.glyph ? '<svg viewBox="0 0 24 24">' + look.glyph + '</svg>' : '';
  return '<div class="mq-word" style="font-family:' + escaped(fontOf(look.family)) + ';font-weight:' + look.weight + '">' + glyph + '<span>' + escaped(item.word) + '</span></div>';
}

const CELL_CLASS = { logos: 'mq-logo', images: 'mq-image', quotes: 'mq-quote' };
const CELL_KIND = { logos: 'logo', images: 'image', quotes: 'quote' };

function itemsOf(p, kind, row) {
  const media = mediaList(p.media).map((src) => ({ src }));
  const lists = {
    logos: () => (media.length ? media : listOf(p.wordmarks, ',').map((word, look) => ({ word, look }))),
    images: () => (media.length ? media : Array.from({ length: 6 }, () => ({}))),
    quotes: () => listOf(p.quotes, '\n').map(quoteOf)
  };
  const list = lists[kind]();
  return list.length ? rotated(list, row) : [{}];
}

root.insertAdjacentHTML('beforeend', '<div class="mq"><div class="mq-rows"></div></div>');

const scene = root.querySelector('.mq');
const rowsEl = root.querySelector('.mq-rows');

let built = { key: '', rows: [] };
let lookKey = '';
const rowStates = [];
let held = null;
let hovered = -1;
let playing = 'live';

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

function paintLook(p, unit) {
  const vertical = isVertical(p);
  const key = JSON.stringify([p.background, p.ink, p.cardColor, p.font, p.quoteSize, p.weight, p.tracking, p.logoOpacity, p.fade, p.rowGap, p.drag, vertical, unit]);
  if (key === lookKey) {
    return;
  }
  lookKey = key;
  const s = scene.style;
  const edge = Math.max(0, Math.min(45, p.fade * 100));
  const towards = vertical ? 'to bottom' : 'to right';
  s.setProperty('--mq-bg', p.background);
  s.setProperty('--mq-ink', p.ink);
  s.setProperty('--mq-card', p.cardColor);
  s.setProperty('--mq-font', fontOf(p.font));
  s.setProperty('--mq-quote', String(p.quoteSize));
  s.setProperty('--mq-weight', String(p.weight));
  s.setProperty('--mq-tracking', p.tracking + 'em');
  s.setProperty('--mq-logo-opacity', String(p.logoOpacity));
  s.setProperty('--mq-row-gap', p.rowGap * unit + 'px');
  s.setProperty('--mq-mask', edge > 0 ? 'linear-gradient(' + towards + ', transparent 0%, #000 ' + edge + '%, #000 ' + (100 - edge) + '%, transparent 100%)' : 'none');
  scene.classList.toggle('mq-x', !vertical);
  scene.classList.toggle('mq-y', vertical);
  scene.classList.toggle('mq-drag', Boolean(p.drag));
}

function buildRows(p, unit, view) {
  const plans = Array.from({ length: rowCount(p) }, (_, row) => {
    const kind = kindOf(p, row);
    const items = itemsOf(p, kind, row);
    return { items, plan: rowPlan(p, row, items.length, duration) };
  });
  const key = JSON.stringify([plans.map((r) => [r.items, r.plan.span, r.plan.cell]), p.monochrome, isVertical(p), unit, view]);
  if (key === built.key) {
    return built.rows;
  }
  rowsEl.innerHTML = '';
  const vertical = isVertical(p);
  const rows = plans.map(({ items, plan }, index) => {
    const row = document.createElement('div');
    row.className = 'mq-row';
    row.dataset.row = String(index);
    row.style[vertical ? 'width' : 'height'] = (vertical ? plan.cell.w : plan.cell.h) * unit + 'px';
    const track = document.createElement('div');
    track.className = 'mq-track';
    const copies = copiesFor(plan, view);
    let html = '';
    for (let copy = 0; copy < copies; copy++) {
      items.forEach((item, i) => {
        const at = (copy * items.length + i) * plan.pitch * unit;
        const place = vertical ? 'top:' + at + 'px' : 'left:' + at + 'px';
        const size = 'width:' + plan.cell.w * unit + 'px;height:' + plan.cell.h * unit + 'px;--mq-size:' + plan.cell.h * unit + 'px;font-size:' + plan.cell.h * unit * 0.42 + 'px';
        html += '<div class="mq-cell ' + CELL_CLASS[plan.kind] + '" style="' + place + ';' + size + '">' + CELL_HTML[CELL_KIND[plan.kind]](item, p) + '</div>';
      });
    }
    track.innerHTML = html;
    row.appendChild(track);
    rowsEl.appendChild(row);
    return { row, track, plan };
  });
  built = { key, rows };
  return rows;
}

function place(entry, offset, unit, vertical) {
  const shift = (offset - entry.plan.span) * unit;
  entry.track.style.transform = vertical ? 'translate3d(0,' + shift + 'px,0)' : 'translate3d(' + shift + 'px,0,0)';
}

function frame(offsetOf) {
  const p = { ...props };
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const vertical = isVertical(p);
  paintLook(p, unit);
  const rows = buildRows(p, unit, (vertical ? height : width) / unit);
  rows.forEach((entry, i) => place(entry, offsetOf(entry.plan, i, p), unit, vertical));
}

const drawAt = (t) => frame((plan) => cruiseAt(plan, t));

function stateOf(plan, i) {
  rowStates[i] = rowStates[i] ?? { pos: plan.phase, vel: plan.cruise, hover: 0, samples: [] };
  return rowStates[i];
}

function liveOffset(dt) {
  return (plan, i, p) => {
    const s = stateOf(plan, i);
    if (held && held.row === i) {
      return wrapped(s.pos, plan.span);
    }
    const goal = p.pauseOnHover && hovered === i ? 1 : 0;
    s.hover = goal + (s.hover - goal) * Math.exp(-dt / HOVER_EASE);
    const next = glideSteps(s, plan.cruise * (1 - s.hover), dt, p.glide);
    s.pos = next.pos;
    s.vel = next.vel;
    return wrapped(s.pos, plan.span);
  };
}

const pointerAt = (e) => {
  const box = scene.getBoundingClientRect();
  const unit = Math.min(box.width, box.height) || 1;
  return (isVertical(props) ? e.clientY - box.top : e.clientX - box.left) / unit;
};

const rowUnder = (e) => {
  const el = e.target && e.target.closest ? e.target.closest('.mq-row') : null;
  return el && root.contains(el) ? Number(el.dataset.row) : -1;
};

const stamp = (e) => (e.timeStamp || 0) / 1000;

function grab(e) {
  const row = rowUnder(e);
  if (!props.drag || row < 0 || !rowStates[row] || playing !== 'live') {
    return;
  }
  const s = rowStates[row];
  const at = pointerAt(e);
  held = { row, pos: s.pos, at };
  s.samples = [{ t: stamp(e), at: s.pos }];
  s.vel = 0;
  built.rows[row].row.classList.add('mq-held');
  e.preventDefault();
}

function follow(e) {
  hovered = rowUnder(e);
  if (!held) {
    return;
  }
  const s = rowStates[held.row];
  s.pos = dragTo(held, pointerAt(e));
  s.samples = [...s.samples, { t: stamp(e), at: s.pos }].slice(-SAMPLES);
}

function release(e) {
  if (!held) {
    return;
  }
  const s = rowStates[held.row];
  follow(e);
  s.vel = flingOf(s.samples);
  built.rows[held.row].row.classList.remove('mq-held');
  held = null;
}

scene.addEventListener('pointerdown', grab);
document.addEventListener('pointermove', follow);
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);
scene.addEventListener('pointerleave', () => {
  hovered = -1;
});
onDestroy(() => {
  document.removeEventListener('pointermove', follow);
  document.removeEventListener('pointerup', release);
  document.removeEventListener('pointercancel', release);
});

let last = null;
function tick(now) {
  if (playing !== 'live') {
    return;
  }
  const dt = last === null ? 0 : Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
  last = now;
  frame(liveOffset(dt));
  requestAnimationFrame(tick);
}

onPause(() => {
  last = null;
});

drawAt(0);
requestAnimationFrame(tick);

return {
  still: (t) => {
    playing = 'still';
    drawAt(t);
  }
};
`;
