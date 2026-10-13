const SPECKS_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -6.2'/></filter><rect width='300' height='300' filter='url(%23s)'/></svg>";

const SCRATCH_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300' fill='none' stroke='white' stroke-linecap='round'><path d='M40 60 l26 -38' stroke-width='1.6'/><path d='M210 140 q8 30 2 70' stroke-width='2'/><path d='M120 250 l44 -12' stroke-width='1.2'/><path d='M260 30 l-18 40' stroke-width='1'/></svg>";

export const CHECKER_VIEW = String.raw`
const WEAR = ${JSON.stringify(`url("${SPECKS_DATA_URI}"), url("${SCRATCH_DATA_URI}")`)};
const BASELINE = 0.86;
const STEP_PAD = 0.04;
const BODY_X = 0.727;
const BODY_TOP = 0.03;
const BODY_WIDTH = 0.245;
const BAR = [0.043, 0.0115];

const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

root.insertAdjacentHTML('beforeend', '<div class="cs"><div class="cs-grid"></div><div class="cs-title"></div><div class="cs-bar"></div><p class="cs-body"></p></div>');

const scene = root.querySelector('.cs');
const grid = root.querySelector('.cs-grid');
const title = root.querySelector('.cs-title');
const bar = root.querySelector('.cs-bar');
const body = root.querySelector('.cs-body');

let cache = { key: '' };

const box = (x, y, w, h) => 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;';

const cells = (cols, rows, cell, shift, start) => {
  const html = [];
  for (let c = 0; c < cols; c++) {
    for (let r = c; r < rows; r++) {
      if ((r + c) % 2 === 0) {
        const at = ((r * 37 + c * 61) % 100) + '% ' + ((r * 53 + c * 29) % 100) + '%';
        html.push('<div class="cs-cell" style="' + box((c - shift) * cell.w, start + r * cell.h, cell.w + 0.5, cell.h + 0.5) + '--cs-at:' + at + '"></div>');
      }
    }
  }
  return html.join('');
};

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
  s.setProperty('--cs-paper', p.paper);
  s.setProperty('--cs-ink', p.ink);
  s.setProperty('--cs-checker', p.checker);
  s.setProperty('--cs-font', fontOf(p));
  s.setProperty('--cs-weight', String(p.fontWeight));
  s.setProperty('--cs-tracking', p.tracking + 'em');
  s.setProperty('--cs-wear', String(p.wear));
  s.setProperty('--cs-wear-image', WEAR);

  const cell = { w: width / p.columns, h: (width / p.columns) * p.cellAspect };
  const start = (p.top * height) / 100;
  const rows = Math.ceil((height - start) / cell.h);
  const cols = Math.ceil(p.columns + p.shift) + 1;
  grid.innerHTML = cells(cols, rows, cell, p.shift, start);

  const size = cell.h * p.titleSize;
  title.innerHTML = String(p.title || '')
    .split('\n')
    .map((line, i) => {
      const x = (i + 2 - p.shift + STEP_PAD) * cell.w;
      const y = start + (i + 2) * cell.h - BASELINE * size;
      return '<div class="cs-step" style="left:' + x + 'px;top:' + y + 'px;font-size:' + size + 'px">' + escaped(line) + '</div>';
    })
    .join('');

  bar.style.cssText = box(BODY_X * width, BODY_TOP * height, BAR[0] * width, BAR[1] * width);
  body.style.cssText = 'left:' + BODY_X * width + 'px;top:' + (BODY_TOP * height + BAR[1] * width * 1.6) + 'px;width:' + BODY_WIDTH * width + 'px;font-size:' + (p.bodySize * width) / 100 + 'px';
  body.textContent = String(p.body || '');
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
