import { NOISE_DATA_URI } from '../poster-kit';

export const TYPE_GRID_VIEW = String.raw`
const NOISE = ${JSON.stringify(`url("${NOISE_DATA_URI}")`)};
const LINK = /^(https?:|data:|blob:|\/)/;
const PHOTO_MARK = '[photo]';
const ARROW_MARK = '->';
const PROBE_PX = 100;
const SHAPES = 3;
const FOOTER_ROWS = 2.6;
const KEPT_AIR = 0.25;
const ARROW_SVG = '<svg class="tg-arrow" viewBox="0 0 105 62" fill="none" stroke="currentColor" stroke-width="9"><path d="M0 31h98M70 3l29 28-29 28"/></svg>';

const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
const mediaList = (raw) => (Array.isArray(raw) ? raw.filter((m) => m.kind !== 'video').map((m) => m.src) : listOf(raw).map((id) => (LINK.test(id) ? id : assets[id]))).filter(Boolean);
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const partsOf = (line) => line.split(/(\[photo\]|->)/).map((s) => s.trim()).filter(Boolean);
const wordsOf = (line) => partsOf(line).filter((s) => s !== PHOTO_MARK && s !== ARROW_MARK).join(' ');

root.insertAdjacentHTML('beforeend', '<div class="tg"><div class="tg-stack"></div><div class="tg-foot"></div><span class="tg-probe"></span></div>');

const scene = root.querySelector('.tg');
const stack = root.querySelector('.tg-stack');
const foot = root.querySelector('.tg-foot');
const probe = root.querySelector('.tg-probe');

let cache = { key: '' };

const photoHtml = (pictures, n) => {
  const src = pictures[n];
  return src ? '<span class="tg-photo"><img decoding="sync" draggable="false" src="' + escaped(src) + '"></span>' : '<span class="tg-photo tg-shape-' + (n % SHAPES) + '"></span>';
};

const lineHtml = (line, pictures, counter) =>
  '<div class="tg-line">' +
  partsOf(line)
    .map((part) => {
      if (part === PHOTO_MARK) {
        return photoHtml(pictures, counter.n++);
      }
      return part === ARROW_MARK ? ARROW_SVG : '<span class="tg-word">' + escaped(part) + '</span>';
    })
    .join('') +
  '</div>';

const widestEm = (lines) =>
  lines.reduce((m, line) => {
    probe.textContent = wordsOf(line);
    return Math.max(m, probe.getBoundingClientRect().width / PROBE_PX);
  }, 1e-6);

const draw = () => {
  const p = { ...props };
  const width = scene.clientWidth || 1080;
  const height = scene.clientHeight || 1350;
  const fonts = document.fonts ? document.fonts.status : 'loaded';
  const key = JSON.stringify([p, width, height, fonts]);
  if (key === cache.key) {
    return;
  }
  cache = { key };

  const s = scene.style;
  const margin = (p.margin * width) / 100;
  const footPx = (p.footerSize * width) / 100;
  s.setProperty('--tg-paper', p.paper);
  s.setProperty('--tg-ink', p.ink);
  s.setProperty('--tg-tint', p.photoTint);
  s.setProperty('--tg-font', fontOf(p));
  s.setProperty('--tg-weight', String(p.fontWeight));
  s.setProperty('--tg-tracking', p.tracking + 'em');
  s.setProperty('--tg-leading', String(p.leading));
  s.setProperty('--tg-margin', margin + 'px');
  s.setProperty('--tg-foot', footPx + 'px');
  s.setProperty('--tg-grain', String(p.photoGrain));
  s.setProperty('--tg-noise', NOISE);

  const lines = String(p.lines || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const room = width - 2 * margin;
  const tall = height - 2 * margin - footPx * FOOTER_ROWS;
  const byWidth = (room * p.fill) / widestEm(lines);
  const byHeight = tall / Math.max(lines.length * p.leading, 1e-6);
  const px = Math.min(byWidth, byHeight);
  const extra = tall - lines.length * p.leading * px - KEPT_AIR * tall;
  s.setProperty('--tg-px', px + 'px');
  s.setProperty('--tg-spread', Math.max(0, extra) / Math.max(lines.length - 1, 1) + 'px');

  const counter = { n: 0 };
  const pictures = mediaList(p.media);
  stack.innerHTML = lines.map((line) => lineHtml(line, pictures, counter)).join('');
  foot.innerHTML = [p.footer1, p.footer2, p.footer3, p.footer4].map((c) => '<div>' + escaped(c || '') + '</div>').join('');
};

draw();
if (document.fonts) {
  document.fonts.ready.then(() => {
    cache = { key: '' };
    draw();
  });
}
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
