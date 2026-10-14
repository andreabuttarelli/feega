export const WIDE_FILMSTRIP_CSS = String.raw`
.wf {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--wf-paper);
  color: var(--wf-ink);
  font-family: var(--wf-font);
  -webkit-font-smoothing: antialiased;
}

.wf-big {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: var(--wf-weight);
  letter-spacing: -0.03em;
  line-height: 0.86;
}

.wf-text {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 400;
  line-height: 1.12;
}

.wf-note {
  position: relative;
  display: block;
  margin-bottom: 0.9em;
}

.wf-tag {
  position: absolute;
  font-size: 0.5em;
  line-height: 1;
}

.wf-strip {
  position: absolute;
  background: var(--wf-strip);
}

.wf-frame {
  position: absolute;
  overflow: hidden;
}

.wf-hole {
  position: absolute;
  background: var(--wf-paper);
}

.wf-count {
  position: absolute;
  color: var(--wf-paper);
  font-family: 'Space Mono', monospace;
  line-height: 1;
}

.wf-index {
  position: absolute;
  margin: 0;
  white-space: pre;
  border-top: 1.5px solid var(--wf-ink);
  line-height: 1;
}
`;

export const WIDE_FILMSTRIP_VIEW = String.raw`
const EDGE = 0.032;
const FRAMES = 2;
const HOLES = 14;

root.insertAdjacentHTML('beforeend', '<div class="wf"></div>');
const scene = root.querySelector('.wf');

const fitWidth = (el, room) => {
  const px = parseFloat(el.style.fontSize);
  el.style.fontSize = (px * room) / Math.max(1, el.scrollWidth) + 'px';
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--wf-paper', p.paper);
  s.setProperty('--wf-ink', p.ink);
  s.setProperty('--wf-strip', p.strip);
  s.setProperty('--wf-font', fontOf(p.font));
  s.setProperty('--wf-weight', String(p.titleWeight));

  const edge = EDGE * width;
  const room = width - edge * 2;
  const text = width * 0.031;
  const small = width * 0.0135;

  const notes = String(p.notes || '').split(/\n\s*\n/).map((para, i) => {
    const [first, ...rest] = linesOf(para.trim());
    const [tag, lead] = first.includes('|') ? first.split('|').map((t) => t.trim()) : ['', first];
    return '<span class="wf-note"' + part('notes', i) + '><span class="wf-tag" style="left:' + -text * 2.2 + 'px;top:' + text * 0.12 + 'px">' + escaped(tag) + '</span>' + escaped([lead, ...rest].join('\n')) + '</span>';
  }).join('');

  scene.innerHTML =
    '<div class="wf-big wf-title"' + part('title') + ' style="left:' + edge + 'px;top:' + edge * 0.6 + 'px;font-size:' + width * 0.3 + 'px">' + escaped(p.title) + '</div>' +
    '<div class="wf-text wf-left"' + part('left') + ' style="left:' + edge + 'px;font-size:' + text + 'px">' + escaped(p.left) + '</div>' +
    '<div class="wf-text wf-right" style="left:' + width * 0.51 + 'px;font-size:' + text + 'px">' + notes + '</div>' +
    '<div class="wf-strip"' + part('photos') + '></div>' +
    '<div class="wf-index"' + part('index') + ' style="left:' + edge + 'px;width:' + width * 0.3 + 'px;padding-top:' + small * 0.6 + 'px;font-size:' + small + 'px">' + escaped(p.index) + '</div>' +
    '<div class="wf-big wf-dates"' + part('dates') + ' style="left:' + edge * 0.7 + 'px;font-size:' + width * 0.2 + 'px">' + escaped(p.dates) + '</div>' +
    '<svg class="wf-mark" width="' + text * 2.6 + '" height="' + text * 2 + '" style="position:absolute;left:' + edge + 'px" fill="none" stroke="' + p.ink + '" stroke-width="' + text * 0.14 + '"><circle cx="' + text * 0.75 + '" cy="' + text + '" r="' + text * 0.62 + '"/><rect x="' + text * 1.3 + '" y="' + text * 0.38 + '" width="' + text * 1.2 + '" height="' + text * 1.24 + '"/></svg>' +
    '<div class="wf-text wf-venue"' + part('venue') + ' style="left:' + (edge + text * 3.4) + 'px;font-size:' + text * 0.9 + 'px">' + escaped(p.venue) + '</div>' +
    '<div class="wf-text wf-address"' + part('address') + ' style="left:' + width * 0.54 + 'px;font-size:' + text * 0.9 + 'px">' + escaped(p.address) + '</div>' +
    upright(p.caption, width - edge * 0.75, height * 0.5, small * 0.8, p.ink);

  const at = (sel) => scene.querySelector(sel);
  const title = at('.wf-title');
  const dates = at('.wf-dates');
  fitWidth(title, room);
  fitWidth(dates, room);

  const columnsTop = title.offsetTop + title.offsetHeight + text * 0.9;
  at('.wf-left').style.top = columnsTop + 'px';
  at('.wf-right').style.top = columnsTop + 'px';
  const columnsEnd = columnsTop + Math.max(at('.wf-left').offsetHeight, at('.wf-right').offsetHeight);

  const footTop = height - edge - text * 2;
  at('.wf-mark').style.top = footTop + 'px';
  at('.wf-venue').style.top = footTop + 'px';
  at('.wf-address').style.top = footTop + 'px';
  const datesTop = footTop - text * 0.9 - dates.offsetHeight;
  dates.style.top = datesTop + 'px';
  const index = at('.wf-index');
  index.style.top = datesTop - small * 3.2 + 'px';

  const stripH = Math.min(width * 0.3, (index.offsetTop - columnsEnd) * 0.8);
  const stripTop = (columnsEnd + index.offsetTop - stripH) / 2;
  const strip = at('.wf-strip');
  strip.style.cssText = box(edge, stripTop, room, stripH);

  const inset = stripH * 0.11;
  const gap = room * 0.03;
  const frameW = (room - inset * 2 - gap * (FRAMES - 1)) / FRAMES;
  const frameH = stripH - inset * 2;
  const photos = photosOf(p.photos);
  const tones = [p.tint, '#4a0b12', '#050505'];
  let inner = '';
  for (let f = 0; f < FRAMES; f++) {
    const x = inset + f * (frameW + gap);
    inner += '<div class="wf-frame" style="' + box(x, inset, frameW, frameH) + '">' + picture(photos, photos.length ? f : 0, frameW, frameH, tones, 'none', 'wf' + f) + '</div>';
    inner += '<div class="wf-count"' + part('counter') + ' style="left:' + x + 'px;top:' + inset * 0.3 + 'px;font-size:' + inset * 0.42 + 'px">' + escaped(p.counter + (f + 1) + 'A') + '</div>';
  }
  const hole = inset * 0.32;
  for (let h = 0; h < HOLES; h++) {
    const x = ((h + 0.5) * room) / HOLES - hole / 2 + room / HOLES / 4;
    inner += '<div class="wf-hole" style="' + box(x, stripH - inset * 0.66, hole, hole) + '"></div>';
  }
  strip.innerHTML = inner;
};
`;
