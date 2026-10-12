import { MEDIA_LIST } from '../media-list';

export const RGB_VIEW = String.raw`
${MEDIA_LIST}
const TINTS = ['#ff0000', '#00ff00', '#0000ff'];
const SERIF = '"Times New Roman", Georgia, serif';
const STREAK = 2.6;
const STREAK_Y = 0.35;
const FILTER_ID = 'rs-streak-' + document.querySelectorAll('.rs').length;

root.insertAdjacentHTML('beforeend', '<div class="rs"><svg class="rs-defs" aria-hidden="true"><filter id="' + FILTER_ID + '" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"></feGaussianBlur></filter></svg><div class="rs-photo"></div><div class="rs-title"></div></div>');

const scene = root.querySelector('.rs');
const photo = root.querySelector('.rs-photo');
const title = root.querySelector('.rs-title');
const streak = root.querySelector('feGaussianBlur');

let cache = { mediaKey: null, channels: [], titleKey: null, words: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const sourceHtml = (item) => {
  if (!item) {
    return '<div class="rs-empty"></div>';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" draggable="false" src="' + item.src + '">';
};

const buildPhoto = (p) => {
  const key = JSON.stringify(p.media || '');
  if (key === cache.mediaKey) {
    return cache.channels;
  }
  const item = mediaList(p.media)[0];
  photo.innerHTML = TINTS.map((tint) => '<div class="rs-channel">' + sourceHtml(item) + '<div class="rs-tint" style="background:' + tint + '"></div></div>').join('');
  const channels = [...photo.querySelectorAll('.rs-channel')].map((node) => {
    const video = node.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node, video };
  });
  cache = { ...cache, mediaKey: key, channels };
  return channels;
};

const buildTitle = (p) => {
  const key = String(p.title || '');
  if (key === cache.titleKey) {
    return cache.words;
  }
  title.innerHTML = '';
  const words = titleWords(key).map((word) => {
    const node = document.createElement('span');
    node.className = 'rs-word';
    node.textContent = word;
    title.appendChild(node);
    return node;
  });
  cache = { ...cache, titleKey: key, words };
  return words;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--rs-bg', p.background);
  s.setProperty('--rs-ink', p.textColor);
  s.setProperty('--rs-empty', p.placeholderColor);
  s.setProperty('--rs-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", ' + SERIF);
  s.setProperty('--rs-weight', String(p.fontWeight));
  s.setProperty('--rs-tracking', p.tracking + 'em');
};

const paintPhoto = (p, f, width, height) => {
  const h = p.mediaHeight * height;
  const w = Math.max(h * p.mediaWidth, Math.min(width, height));
  const s = photo.style;
  s.width = w + 'px';
  s.height = h + 'px';
  s.left = p.mediaX * width - w / 2 + 'px';
  s.top = (height - h) / 2 + 'px';
  s.transform = 'translate3d(' + f.drift * width + 'px, 0, 0) scale(' + f.zoom + ')';
};

const paintChannels = (channels, f, width, height, t) => {
  const blur = f.blur * Math.min(width, height);
  const sharp = blur < 0.01;
  streak.setAttribute('stdDeviation', blur * STREAK + ' ' + blur * STREAK_Y);
  channels.forEach((c, i) => {
    c.node.style.transform = 'translate3d(' + f.offsets[i] * width + 'px, 0, 0)';
    c.node.style.filter = sharp ? 'none' : 'url(#' + FILTER_ID + ')';
    seekVideo(c.video, t);
  });
};

const paintTitle = (p, words, f, width) => {
  title.style.fontSize = p.fontSize * width + 'px';
  title.style.top = '50%';
  title.style.transform = 'translate3d(0, -50%, 0)';
  words.forEach((node, i) => {
    const w = f.words[i];
    node.style.opacity = String(w.opacity);
    node.style.transform = 'translate3d(0, ' + w.rise + 'em, 0)';
    node.style.visibility = w.opacity > 0.002 ? 'visible' : 'hidden';
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const channels = buildPhoto(p);
  const words = buildTitle(p);
  const f = rgbFrame(p, t, duration, words.length);
  paintLook(p);
  paintPhoto(p, f, width, height);
  paintChannels(channels, f, width, height, t);
  paintTitle(p, words, f, width);
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
