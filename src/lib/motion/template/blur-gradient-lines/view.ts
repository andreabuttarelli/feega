import { MEDIA_LIST } from '../media-list';

export const BLUR_LINES_VIEW = String.raw`
${MEDIA_LIST}
const TEXT_SAFE = 0.88;
const GLOW_EM = 0.35;

root.insertAdjacentHTML('beforeend', '<div class="bgl"><div class="bgl-shape"></div><div class="bgl-lines"></div><div class="bgl-text"><h1 class="bgl-headline"></h1></div></div>');

const scene = root.querySelector('.bgl');
const shape = root.querySelector('.bgl-shape');
const linesBox = root.querySelector('.bgl-lines');
const headline = root.querySelector('.bgl-headline');

let cache = { mediaKey: '', video: null, lookKey: '', textKey: '', letters: [], lines: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const paintShape = (p) => {
  const key = JSON.stringify(p.media);
  if (key === cache.mediaKey) {
    return cache.video;
  }
  const item = mediaList(p.media)[0];
  shape.classList.toggle('has-media', Boolean(item));
  shape.innerHTML = !item ? '' : item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
  const video = shape.querySelector('video');
  if (video) {
    video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
  }
  cache = { ...cache, mediaKey: key, video };
  return video;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.topColor, p.bottomColor, p.textColor, p.glowColor, p.lineColor, p.shapeColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--bgl-top', p.topColor);
  s.setProperty('--bgl-bottom', p.bottomColor);
  s.setProperty('--bgl-ink', p.textColor);
  s.setProperty('--bgl-glow', p.glowColor);
  s.setProperty('--bgl-line', p.lineColor);
  s.setProperty('--bgl-shape', p.shapeColor);
  s.setProperty('--bgl-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--bgl-weight', String(p.fontWeight));
  s.setProperty('--bgl-tracking', p.tracking + 'em');
};

const paintText = (p) => {
  const key = String(p.text || '');
  if (key === cache.textKey) {
    return cache.letters;
  }
  headline.innerHTML = '';
  const letters = Array.from(key.trim()).map((c) => {
    const span = document.createElement('span');
    span.className = 'bgl-letter';
    span.textContent = c;
    headline.appendChild(span);
    return span;
  });
  cache = { ...cache, textKey: key, letters };
  return letters;
};

const paintLines = (count) => {
  if (cache.lines.length === count) {
    return cache.lines;
  }
  linesBox.innerHTML = '';
  const lines = Array.from({ length: count }, () => {
    const node = document.createElement('i');
    node.className = 'bgl-line';
    linesBox.appendChild(node);
    return node;
  });
  cache = { ...cache, lines };
  return lines;
};

const fitText = (p, unit, width) => {
  headline.style.fontSize = p.fontSize * unit / 100 + 'px';
  const natural = headline.scrollWidth || 1;
  const fit = Math.min(1, (TEXT_SAFE * width) / natural);
  headline.style.fontSize = (p.fontSize * unit * fit) / 100 + 'px';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  paintLook(p);
  const video = paintShape(p);
  const letters = paintText(p);
  fitText(p, unit, width);
  const widths = letters.map((l) => l.offsetWidth);
  const f = blurLinesFrame(p, t, duration, widths);

  const h = p.shapeSize * unit;
  const s = shape.style;
  s.width = h * 0.68 + 'px';
  s.height = h + 'px';
  s.filter = 'blur(' + (p.blur * unit) / 100 + 'px)';
  s.transform = 'translate(-50%, -50%) translate3d(' + (p.shapeX * width + f.blob.x * unit) + 'px, ' + f.blob.y * unit + 'px, 0) rotate(' + (f.blob.rotate - 8) + 'deg) scale(' + f.blob.scale + ')';
  seekVideo(video, t);

  paintLines(f.lines.length).forEach((node, i) => {
    const l = f.lines[i];
    node.style.top = l.at * 100 + '%';
    node.style.opacity = String(p.lineOpacity * Math.min(1, l.scale * 4));
    node.style.transform = 'scaleX(' + l.scale + ')';
  });

  headline.style.opacity = String(f.text);
  headline.style.transform = 'translate3d(' + f.shift + 'px, 0, 0)';
  f.letters.forEach((l, i) => {
    const glow = Math.round(l.glow * 100);
    letters[i].style.opacity = String(l.opacity);
    letters[i].style.textShadow = glow > 0 ? '0 0 ' + GLOW_EM + 'em color-mix(in srgb, var(--bgl-glow) ' + glow + '%, transparent), 0 0 ' + GLOW_EM / 3 + 'em color-mix(in srgb, var(--bgl-glow) ' + glow + '%, transparent)' : 'none';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
