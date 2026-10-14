export const CURATED_BOARD_CSS = String.raw`
.cb {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--cb-paper);
  color: var(--cb-ink);
  font-family: var(--cb-mono);
  -webkit-font-smoothing: antialiased;
}

.cb-thumb {
  position: absolute;
  overflow: hidden;
}

.cb-cap {
  position: absolute;
  display: flex;
  justify-content: space-between;
  white-space: pre;
  line-height: 1;
}

.cb-centre {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cb-title {
  position: relative;
  margin: 0;
  white-space: pre;
  font-family: var(--cb-font);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1;
}

.cb-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cb-accent);
  color: var(--cb-paper);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cb-row {
  display: flex;
  justify-content: center;
}

.cb-tag {
  position: relative;
  white-space: pre;
  line-height: 1;
  text-transform: uppercase;
}

.cb-corner {
  position: absolute;
  white-space: pre;
  line-height: 1;
  text-transform: uppercase;
}
`;

export const CURATED_BOARD_VIEW = String.raw`
const THUMB_ASPECT = 0.8;
const THUMB_MAX_WIDTH = 0.29;
const TONES = [
  ['#efff5c', '#b8cc1e', '#4d5a08'],
  ['#ff7ab8', '#c9206f', '#35102a'],
  ['#ffffff', '#a8a8a8', '#141414'],
  ['#5566ff', '#e8361e', '#14164a'],
  ['#9a9a9a', '#454545', '#101010'],
  ['#d3dce4', '#71818f', '#1e2832'],
  ['#f2e8dc', '#c4b29c', '#54463a'],
  ['#e9e9e9', '#cfcfcf', '#2a2a2a']
];

root.insertAdjacentHTML('beforeend', '<div class="cb"></div>');
const scene = root.querySelector('.cb');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--cb-paper', p.paper);
  s.setProperty('--cb-ink', p.ink);
  s.setProperty('--cb-accent', p.accent);
  s.setProperty('--cb-font', fontOf(p.font));
  s.setProperty('--cb-mono', fontOf(p.mono));

  const photos = photosOf(p.photos);
  const th = Math.min((p.thumbSize / 100) * height, (width * THUMB_MAX_WIDTH) / THUMB_ASPECT);
  const tw = th * THUMB_ASPECT;
  const small = width * 0.0135;
  const captions = linesOf(p.captions);

  const thumbs = linesOf(p.slots).filter((l) => l.trim()).map((line, i) => {
    const [cx, top] = numbersOf(line);
    const x = (cx / 100) * width - tw / 2;
    const y = (top / 100) * height;
    const [number, name] = String(captions[i] || '').split('|').map((t) => t.trim());
    const cap = '<div class="cb-cap"' + part('captions', i) + ' style="' + box(x, y + th + small * 1.1, tw, small) + 'font-size:' + small + 'px"><span>' + escaped(number || '') + '</span><span>' + escaped(name || '') + '</span></div>';
    return '<div class="cb-thumb"' + part('slots', i) + ' style="' + box(x, y, tw, th) + '">' + picture(photos, i, tw, th, TONES[i % TONES.length]) + '</div>' + cap;
  }).join('');

  const titlePx = (p.titleSize / 100) * width;
  const tagPx = width * 0.026;
  const tagStyle = 'font-size:' + tagPx + 'px;padding:' + tagPx * 0.32 + 'px ' + tagPx * 0.6 + 'px;margin:' + tagPx * 0.2 + 'px';
  const tagLines = linesOf(p.tags).filter((l) => l.trim());
  const tag = (t, i) => '<div class="cb-tag"' + part('tags', i) + ' style="' + tagStyle + '">' + escaped(t.trim()) + '</div>';
  const rows = '<div class="cb-row" style="margin-top:' + titlePx * 0.32 + 'px">' + tagLines.slice(0, 1).map(tag).join('') + '</div><div class="cb-row">' + tagLines.slice(1).map((t, i) => tag(t, i + 1)).join('') + '</div>';
  const markerPx = titlePx * 0.42;
  const marker = '<div class="cb-marker"' + part('marker') + ' style="right:' + -markerPx * 0.9 + 'px;top:' + -markerPx * 0.35 + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;font-size:' + markerPx * 0.42 + 'px">' + escaped(p.marker) + '</div>';
  const centre = '<div class="cb-centre" style="top:' + (height / 2 - titlePx * 0.75) + 'px"><div class="cb-title"' + part('title') + ' style="font-size:' + titlePx + 'px">' + escaped(p.title) + marker + '</div>' + rows + '</div>';

  const edge = width * 0.022;
  const corners =
    '<div class="cb-corner"' + part('issue') + ' style="left:' + edge + 'px;top:' + edge + 'px;font-size:' + small + 'px">' + escaped(p.issue) + '</div>' +
    '<div class="cb-corner"' + part('caption') + ' style="right:' + edge + 'px;top:' + edge + 'px;font-size:' + small + 'px">' + escaped(p.caption) + '</div>';

  scene.innerHTML = thumbs + centre + corners;

  for (const el of scene.querySelectorAll('.cb-tag')) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const stroke = Math.max(1.5, width / 540);
    el.insertAdjacentHTML('afterbegin', '<svg width="' + w + '" height="' + h + '" style="position:absolute;left:0;top:0;overflow:visible"><rect x="' + stroke / 2 + '" y="' + stroke / 2 + '" width="' + (w - stroke) + '" height="' + (h - stroke) + '" rx="' + (h - stroke) / 2 + '" fill="none" stroke="' + p.ink + '" stroke-width="' + stroke + '"/></svg>');
  }

  const titleEl = scene.querySelector('.cb-title');
  const room = width * 0.62;
  if (titleEl.scrollWidth > room) {
    titleEl.style.fontSize = (titlePx * room) / titleEl.scrollWidth + 'px';
  }
};
`;
