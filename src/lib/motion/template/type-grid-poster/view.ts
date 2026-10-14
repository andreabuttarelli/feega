import { NOISE_DATA_URI } from '../poster-kit';
import { fillLayersHtml } from '../../fill/render';

export const TYPE_GRID_VIEW = String.raw`
const NOISE = ${JSON.stringify(`url("${NOISE_DATA_URI}")`)};
const LINK = /^(https?:|data:|blob:|\/)/;
const PHOTO_MARK = '[photo]';
const ARROW_MARK = '->';
const PROBE_PX = 100;
const SHAPES = 3;
const FOOTER_ROWS = 2.6;
const KEPT_AIR = 0.25;
const ARROW_SVG = '<svg viewBox="0 0 105 62" fill="none" stroke="currentColor" stroke-width="9"><path d="M0 31h98M70 3l29 28-29 28"/></svg>';

const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
const fillLayersHtml = (${fillLayersHtml.toString()});
const pictureLayer = (src) => ({ type: 'image', src, fit: 'cover', focus: { x: 0.5, y: 0.5 }, scale: 1, opacity: 1, visible: true, blend: 'normal' });
const slotOf = (m) => ({ fills: m.kind === 'video' ? [] : m.fills || [] });
const pictureSlot = (src) => ({ fills: src ? [pictureLayer(src)] : [] });
const mediaList = (raw) => (Array.isArray(raw) ? raw.map(slotOf) : listOf(raw).map((id) => pictureSlot(LINK.test(id) ? id : assets[id])));
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const partsOf = (line) => line.split(/(\[photo\]|->)/).map((s) => s.trim()).filter(Boolean);
const wordsOf = (line) => partsOf(line).filter((s) => s !== PHOTO_MARK && s !== ARROW_MARK).join(' ');

root.insertAdjacentHTML('beforeend', '<div class="tg"><div class="tg-stack"></div><div class="tg-foot"></div><div class="tg-extra"></div><span class="tg-probe"></span></div>');

const scene = root.querySelector('.tg');
const stack = root.querySelector('.tg-stack');
const foot = root.querySelector('.tg-foot');
const probe = root.querySelector('.tg-probe');
const marks = root.querySelector('.tg-extra');

let cache = { key: '' };

const photoHtml = (pictures, n) => {
  const fills = (pictures[n] || {}).fills || [];
  const tag = ' data-part="photos:' + n + '"';
  return fills.length ? '<span class="tg-photo"' + tag + '>' + fillLayersHtml(fills) + '</span>' : '<span class="tg-photo tg-shape-' + (n % SHAPES) + '"' + tag + '></span>';
};

const arrowHtml = (i) => '<span class="tg-arrow" data-part="arrow:' + i + '">' + ARROW_SVG + '</span>';

const lineHtml = (line, pictures, counter, i) =>
  '<div class="tg-line" data-part="lines:' + i + '">' +
  partsOf(line)
    .map((part) => {
      if (part === PHOTO_MARK) {
        return photoHtml(pictures, counter.n++);
      }
      return part === ARROW_MARK ? arrowHtml(i) : '<span class="tg-word">' + escaped(part) + '</span>';
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
  s.setProperty('--tg-arrow', p.arrowColor || p.ink);
  s.setProperty('--tg-tint', p.photoTint);
  s.setProperty('--tg-font', fontOf(p));
  s.setProperty('--tg-weight', String(p.fontWeight));
  s.setProperty('--tg-tracking', p.tracking + 'em');
  s.setProperty('--tg-leading', String(p.leading));
  s.setProperty('--tg-margin', margin + 'px');
  s.setProperty('--tg-foot', footPx + 'px');
  s.setProperty('--tg-grain', String(p.photoGrain));
  s.setProperty('--tg-noise', NOISE);

  const rows = String(p.lines || '').split('\n').map((l, at) => ({ l: l.trim(), at })).filter((r) => r.l);
  const lines = rows.map((r) => r.l);
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
  stack.innerHTML = lines.map((line, i) => lineHtml(line, pictures, counter, rows[i].at)).join('');
  const footTop = height - margin - footPx * FOOTER_ROWS * 0.62;
  marks.innerHTML =
    '<div class="tg-rule" style="left:' + margin + 'px;right:' + margin + 'px;top:' + (footTop - footPx * 0.9) + 'px;height:' + Math.max(2, width * 0.003) + 'px"></div>' +
    '<div class="tg-stamp" style="right:' + margin + 'px;top:' + (footTop - footPx * 3.4) + 'px;font-size:' + footPx + 'px">' + escaped(p.issue) + '</div>' +
    '<div class="tg-caption" style="left:' + (width - margin * 0.72) + 'px;top:' + (footTop - footPx * 4.5) + 'px;font-size:' + footPx * 0.75 + 'px">' + escaped(p.caption) + '</div>';
  foot.innerHTML = [p.footer1, p.footer2, p.footer3, p.footer4].map((c, i) => '<div data-part="footer' + (i + 1) + '">' + escaped(c || '') + '</div>').join('');
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
