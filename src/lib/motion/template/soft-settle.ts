import { WORD_ENTRANCE } from './word-entrance';

export const SOFT_SETTLE = String.raw`
${WORD_ENTRANCE}
const SETTLE = 0.014;
const SETTLE_SHARE = 0.24;

function glide(x) {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const reach = 1 - SETTLE_SHARE;
  if (x < reach) {
    return (1 + SETTLE) * expoInOut(x / reach);
  }
  return 1 + SETTLE * (1 - smooth((x - reach) / SETTLE_SHARE));
}

const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (x, n) => ((x % n) + n) % n;
const TURN = Math.PI * 2;
const loopWave = (t, length, cycles, phase = 0) => Math.sin((TURN * cycles * t) / Math.max(length, 1e-6) + phase);
const fontOf = (f) => (String(f).includes(',') ? f : '"' + f + '", "Helvetica Neue", Arial, sans-serif');
const linesOf = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
`;

export const MEDIA_SLOT = String.raw`
const mediaHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const mountMedia = (node, item) => {
  node.innerHTML = mediaHtml(item);
  const video = node.querySelector('video');
  if (video) {
    video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
  }
  return video;
};

const make = (host, tag, className) => {
  const node = document.createElement(tag);
  node.className = className;
  host.appendChild(node);
  return node;
};
`;
