export const SPLIT_VIEW = String.raw`
const VIDEO_MARK = 'video:';
const LINK = /^(https?:|data:|blob:|\/)/;
const HIDDEN_BELOW = 1e-4;

const mediaOf = (raw) => {
  const item = String(raw || '').trim();
  const video = item.startsWith(VIDEO_MARK);
  const id = video ? item.slice(VIDEO_MARK.length).trim() : item;
  const src = LINK.test(id) ? id : assets[id];
  return src ? { src, video } : null;
};

root.insertAdjacentHTML('beforeend', '<div class="sh"><div class="sh-media"></div><div class="sh-half sh-left"></div><div class="sh-half sh-right"></div><span class="sh-half sh-probe"> </span></div>');

const scene = root.querySelector('.sh');
const frame = root.querySelector('.sh-media');
const halves = { left: root.querySelector('.sh-left'), right: root.querySelector('.sh-right') };
const probe = root.querySelector('.sh-probe');

let cache = { wordsKey: '', words: [], mediaKey: '', picture: null, video: null, lookKey: '', measureKey: '', layout: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontsReady = () => (document.fonts ? document.fonts.status : 'loaded');
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');

const fillHalf = (node, words, p) => {
  node.innerHTML = '';
  return words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'sh-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    node.appendChild(span);
    return span;
  });
};

const buildWords = (p) => {
  const key = JSON.stringify([p.headline, p.splitAt, p.lowercase]);
  if (key === cache.wordsKey) {
    return cache.words;
  }
  const parts = splitWords(p.headline, p.splitAt);
  const words = [...fillHalf(halves.left, parts.left, p), ...fillHalf(halves.right, parts.right, p)];
  cache = { ...cache, wordsKey: key, words, measureKey: '' };
  return words;
};

const buildMedia = (p) => {
  const key = String(p.media || '');
  if (key === cache.mediaKey) {
    return;
  }
  const item = mediaOf(p.media);
  frame.innerHTML = item ? (item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">') : '';
  cache = { ...cache, mediaKey: key, picture: frame.firstElementChild, video: frame.querySelector('video') };
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key, measureKey: '' };
  const s = scene.style;
  s.setProperty('--sh-bg', p.background);
  s.setProperty('--sh-ink', p.textColor);
  s.setProperty('--sh-empty', p.placeholderColor);
  s.setProperty('--sh-font', fontOf(p));
  s.setProperty('--sh-weight', String(p.fontWeight));
  s.setProperty('--sh-tracking', p.tracking + 'em');
};

const measure = (p) => {
  const { width, height } = sizeOf();
  const px = (p.fontSize * Math.min(width, height)) / 100;
  const key = JSON.stringify([width, height, px, cache.wordsKey, cache.lookKey, p.imageHeight, p.aspect, p.gap, p.stack, fontsReady()]);
  if (key === cache.measureKey) {
    return cache.layout;
  }
  scene.style.setProperty('--sh-px', px + 'px');
  const em = (node) => node.getBoundingClientRect().width / px;
  const layout = splitLayout(p, { leftW: em(halves.left), rightW: em(halves.right), space: em(probe), frameW: width / px, frameH: height / px });
  scene.style.setProperty('--sh-px', px * layout.fit + 'px');
  cache = { ...cache, measureKey: key, layout };
  return layout;
};

const seekVideo = (video, t) => {
  if (!video || !(video.duration > 0)) {
    return;
  }
  const at = t % video.duration;
  if (Math.abs(video.currentTime - at) > 0.5 / fps) {
    video.currentTime = at;
  }
};

const placeHalves = (layout, f) => {
  if (layout.axis === 'row') {
    halves.left.style.transform = 'translate(calc(-100% + ' + f.left.x + 'em), -50%)';
    halves.right.style.transform = 'translate(' + f.right.x + 'em, -50%)';
    return;
  }
  halves.left.style.transform = 'translate(-50%, calc(-50% + ' + f.left.y + 'em))';
  halves.right.style.transform = 'translate(-50%, calc(-50% + ' + f.right.y + 'em))';
};

const placeImage = (layout, f, p) => {
  const s = frame.style;
  s.width = f.image.w + 'em';
  s.height = f.image.h + 'em';
  s.transform = 'translate(-50%, -50%) translate(' + f.image.x + 'em, ' + f.image.y + 'em)';
  s.visibility = f.image.w > HIDDEN_BELOW && f.image.h > HIDDEN_BELOW ? 'visible' : 'hidden';
  s.opacity = String(f.image.opacity);
  s.borderRadius = (p.radius / 100) * layout.imgH + 'em';
  if (!cache.picture) {
    return;
  }
  const ps = cache.picture.style;
  ps.width = layout.imgW + 'em';
  ps.height = layout.imgH + 'em';
  ps.transform = 'translate(-50%, -50%) scale(' + f.image.zoom + ')';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const words = buildWords(p);
  buildMedia(p);
  paintLook(p);
  const layout = measure(p);
  const f = splitFrame(layout, p, t, duration, words.length);

  placeHalves(layout, f);
  placeImage(layout, f, p);
  seekVideo(cache.video, t);
  f.words.forEach((w, i) => {
    words[i].style.opacity = String(w.opacity);
    words[i].style.transform = 'translateY(' + w.rise + 'em)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
