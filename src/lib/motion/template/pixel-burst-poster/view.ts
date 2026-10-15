import { POSTER_ART, POSTER_PHOTOS, POSTER_SHAPES, POSTER_TEXT } from '../poster-kit';

export const PIXEL_BURST_CSS = String.raw`
.pb {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.018) 0 2px, transparent 2px 9px),
    radial-gradient(ellipse at 40% 30%, rgb(255 255 255 / 0.06), transparent 60%),
    var(--pb-paper);
  -webkit-font-smoothing: antialiased;
}

.pb-layer {
  position: absolute;
  inset: 0;
}
`;

export const PIXEL_BURST_VIEW = String.raw`
${POSTER_TEXT}
${POSTER_SHAPES}
${POSTER_PHOTOS}
${POSTER_ART}
root.insertAdjacentHTML('beforeend', '<div class="pb"></div>');
const scene = root.querySelector('.pb');

const RIGHT = 'text-align:right;transform:translateX(-100%);';
const INNER = 0.34;
const JITTER = 0.32;
const TONES = ['#ffffff', '#d2d2d2', '#5a5a5a'];

const burstPath = (cx, cy, r, points) => {
  const all = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const reach = i % 2 ? r * INNER : r * (1 - JITTER * artSeq(i + 3));
    all.push((i ? 'L' : 'M') + (cx + Math.cos(a) * reach) + ' ' + (cy + Math.sin(a) * reach));
  }
  return all.join('') + 'Z';
};

const burstHtml = (p, width, height) => {
  const r = (p.burstSize / 200) * width;
  const cx = (p.burstX / 100) * width;
  const cy = (p.burstY / 100) * height;
  const d = burstPath(cx, cy, r, Math.round(p.burstPoints));
  const photo = picture(photosOf(p.photo), 0, 2 * r, 2 * r, TONES, 'grayscale(1) contrast(1.5)', 'pb');
  return '<svg class="pb-layer" width="' + width + '" height="' + height + '"><defs><clipPath id="pbStar"><path d="' + d + '"/></clipPath></defs>' +
    '<path' + part('burst') + ' d="' + d + '" fill="' + p.burstColor + '"/>' +
    '<g' + part('photo') + ' clip-path="url(#pbStar)" style="mix-blend-mode:multiply"><g transform="translate(' + (cx - r) + ' ' + (cy - r) + ')">' + photo + '</g></g></svg>';
};

const buttonHtml = (p, width, height) => {
  const px = (p.smallSize / 100) * width;
  return '<div' + part('button') + ' style="position:absolute;left:' + (p.buttonX / 100) * width + 'px;top:' + (p.buttonY / 100) * height + 'px;font-size:' + px + 'px;line-height:1;padding:0.35em 0.9em;border:' + Math.max(1, px * 0.08) + 'px solid ' + p.buttonColor + ';border-radius:999px;color:' + p.buttonColor + '">' + escaped(p.button) + '</div>';
};

const draw = (p, width, height) => {
  scene.style.setProperty('--pb-paper', p.paper);
  scene.style.fontFamily = fontOf(p.smallFont);
  const title = textPart(p, 'title', width, height, 'line-height:0.9;letter-spacing:0.01em;transform-origin:0 50%;transform:skewX(-14deg);');
  const stack = textPart(p, 'stack', width, height, RIGHT + 'line-height:0.84;letter-spacing:-0.045em;');
  const small = textPart(p, 'details', width, height, 'line-height:1.12;') + textPart(p, 'index', width, height, RIGHT + 'font-size:' + width * 0.013 + 'px;');
  const marker = textPart(p, 'marker', width, height, 'font-size:' + width * 0.016 + 'px;letter-spacing:0.12em;padding:0.3em 0.5em;background:' + p.markerColor + ';color:' + p.paper + ';');
  scene.innerHTML = title + burstHtml(p, width, height) + stack + small + buttonHtml(p, width, height) + marker;
};
`;
