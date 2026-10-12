export const STORY_VIEW = String.raw`
const LINK = /^(https?:|data:|blob:|\/)/;
const HAIRLINE_BASE = 1080;
const pad2 = (n) => String(n).padStart(2, '0');

const sourceOf = (raw) => {
  const id = String(raw || '').trim();
  return LINK.test(id) ? id : assets[id] || '';
};

root.insertAdjacentHTML('beforeend', '<div class="ss"><div class="ss-grid"></div><div class="ss-images"></div><div class="ss-text"></div><div class="ss-kicker"></div><div class="ss-index"><span class="ss-index-now"></span><span class="ss-index-of"></span></div><div class="ss-progress"><i class="ss-bar"></i></div></div>');

const scene = root.querySelector('.ss');
const gridLayer = root.querySelector('.ss-grid');
const imageLayer = root.querySelector('.ss-images');
const textLayer = root.querySelector('.ss-text');
const kickerLayer = root.querySelector('.ss-kicker');
const indexNow = root.querySelector('.ss-index-now');
const indexOf = root.querySelector('.ss-index-of');
const progressLayer = root.querySelector('.ss-progress');
const bar = root.querySelector('.ss-bar');

let cache = { gridKey: '', grid: null, contentKey: '', content: null, lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const maskedLine = (text) => {
  const line = document.createElement('span');
  line.className = 'ss-line';
  const inner = document.createElement('span');
  inner.className = 'ss-in';
  inner.textContent = text;
  line.appendChild(inner);
  return { line, inner };
};

const buildGrid = (p, width, height) => {
  const key = JSON.stringify([width, height, p.columns, p.rows, p.margin]);
  if (key === cache.gridKey) {
    return cache.grid;
  }
  const grid = storyGrid(p, width, height);
  const top = grid.ys[0];
  const left = grid.xs[0];
  const tall = grid.ys[grid.ys.length - 1] - top;
  const wide = grid.xs[grid.xs.length - 1] - left;
  gridLayer.innerHTML = '';
  const line = (cls, s) => {
    const node = document.createElement('i');
    node.className = cls;
    Object.assign(node.style, s);
    gridLayer.appendChild(node);
    return node;
  };
  const v = grid.xs.map((x) => line('ss-v', { left: x + 'px', top: top + 'px', height: tall + 'px' }));
  const h = grid.ys.map((y) => line('ss-h', { top: y + 'px', left: left + 'px', width: wide + 'px' }));
  cache = { ...cache, gridKey: key, grid: { ...grid, v, h, top, left, tall, wide } };
  return cache.grid;
};

const buildContent = (p) => {
  const chapters = storyChapters(p);
  const key = JSON.stringify([chapters, p.lowercase]);
  if (key === cache.contentKey) {
    return cache.content;
  }
  const cased = (s) => (p.lowercase ? s.toLowerCase() : s);
  imageLayer.innerHTML = '';
  textLayer.innerHTML = '';
  kickerLayer.innerHTML = '';
  indexNow.innerHTML = '';
  progressLayer.querySelectorAll('.ss-mark').forEach((m) => m.remove());
  const content = chapters.map((chapter, i) => {
    const figure = document.createElement('figure');
    figure.className = 'ss-fig';
    const src = sourceOf(chapter.image);
    figure.innerHTML = '<div class="ss-pic">' + (src ? '<img decoding="sync" src="' + src + '">' : '') + '</div><figcaption class="ss-cap">' + pad2(i + 1) + '</figcaption>';
    imageLayer.appendChild(figure);
    const head = document.createElement('div');
    head.className = 'ss-head';
    const lines = chapter.lines.map((text) => {
      const l = maskedLine(cased(text));
      head.appendChild(l.line);
      return l;
    });
    textLayer.appendChild(head);
    const kicker = maskedLine(chapter.kicker);
    kickerLayer.appendChild(kicker.line);
    const index = maskedLine(pad2(i + 1));
    indexNow.appendChild(index.line);
    const mark = document.createElement('span');
    mark.className = 'ss-mark';
    mark.textContent = pad2(i + 1);
    progressLayer.appendChild(mark);
    return { figure, img: figure.querySelector('img'), lines, kicker, index, mark };
  });
  indexOf.textContent = ' / ' + pad2(chapters.length);
  cache = { ...cache, contentKey: key, content };
  return content;
};

const paintLook = (p, unit) => {
  const key = JSON.stringify([p.background, p.textColor, p.labelColor, p.lineColor, p.lineOpacity, p.font, p.fontSize, p.fontWeight, p.tracking, p.showLabels, unit]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ss-bg', p.background);
  s.setProperty('--ss-ink', p.textColor);
  s.setProperty('--ss-label', p.labelColor);
  s.setProperty('--ss-line', p.lineColor);
  s.setProperty('--ss-line-opacity', String(p.lineOpacity));
  s.setProperty('--ss-hair', Math.max(1, unit / HAIRLINE_BASE) + 'px');
  s.setProperty('--ss-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--ss-size', String(p.fontSize));
  s.setProperty('--ss-weight', String(p.fontWeight));
  s.setProperty('--ss-tracking', p.tracking + 'em');
  scene.classList.toggle('ss-bare', !p.showLabels);
};

const paintSlot = (target, slot) => {
  target.line.style.visibility = slot.on ? 'visible' : 'hidden';
  target.inner.style.transform = 'translateY(' + slot.y * 100 + '%)';
  target.inner.style.opacity = String(slot.opacity);
};

const place = (grid) => {
  const inset = grid.col * 0.12;
  Object.assign(kickerLayer.style, { left: grid.left + inset + 'px', top: grid.top + inset + 'px' });
  Object.assign(progressLayer.style, { left: grid.left + 'px', top: grid.top + grid.tall + 'px', width: grid.wide + 'px' });
  const index = indexNow.parentElement;
  Object.assign(index.style, { right: grid.left + inset + 'px', top: grid.top + inset + 'px' });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const grid = buildGrid(p, width, height);
  const content = buildContent(p);
  paintLook(p, Math.min(width, height));
  place(grid);
  const f = storyFrame(p, t, duration, width, height);

  f.grid.v.forEach((k, i) => (grid.v[i].style.transform = 'scaleY(' + k + ')'));
  f.grid.h.forEach((k, i) => (grid.h[i].style.transform = 'scaleX(' + k + ')'));

  content.forEach((c, i) => {
    const img = f.images[i];
    const s = c.figure.style;
    s.width = img.w + 'px';
    s.height = img.h + 'px';
    s.transform = 'translate3d(' + img.x + 'px, ' + img.y + 'px, 0)';
    s.visibility = img.y < height && img.y + img.h > 0 ? 'visible' : 'hidden';
    if (c.img) {
      c.img.style.transform = 'translateY(' + img.shift * 100 + '%)';
    }
    const head = f.heads[i];
    c.lines.forEach((l, j) => paintSlot(l, head.lines[j]));
    paintSlot(c.kicker, head.kicker);
    paintSlot(c.index, head.index);
    c.mark.style.left = (i / content.length) * 100 + '%';
    c.mark.style.opacity = String(f.marks[i]);
  });
  bar.style.transform = 'scaleX(' + f.progress + ')';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
