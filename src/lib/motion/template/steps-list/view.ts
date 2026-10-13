export const STEPS_VIEW = String.raw`
const FIT = 0.86;
const LEFT = 0.097;
const TOP = 0.53;
const WORKING_BASE = 0.3;
const WORKING_GLOW = 0.55;
const DONE_DIM = 0.3;
const GLYPHS = [
  '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3.6" stroke-dasharray="1.2 1.6"/>',
  '<rect x="3.5" y="3.5" width="17" height="17"/><circle cx="12" cy="10" r="2.6"/><path d="M7 20c.8-3 2.8-4.6 5-4.6s4.2 1.6 5 4.6"/>',
  '<path d="M14 3.5H3.5v17h17V10"/><path d="M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5.5"/><path d="M18.5 2v6M15.5 5h6"/>',
  '<path d="M4 6h16M4 12h16M4 18h10"/>',
  '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.8 2.8L16.2 9.6"/>'
];

root.insertAdjacentHTML('beforeend', '<div class="stl"><div class="stl-block"><div class="stl-heading"></div><div class="stl-body"><div class="stl-line"></div><div class="stl-steps"></div></div><div class="stl-working"></div></div></div>');

const scene = root.querySelector('.stl');
const block = root.querySelector('.stl-block');
const heading = root.querySelector('.stl-heading');
const line = root.querySelector('.stl-line');
const list = root.querySelector('.stl-steps');
const working = root.querySelector('.stl-working');

let cache = { lookKey: '', textKey: '', rows: [], letters: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontOf = (font) => (String(font).includes(',') ? font : '"' + font + '", system-ui, sans-serif');
const accentOf = (p, i) => [p.accent1, p.accent2, p.accent3][i % 3];

const rowNode = (step, i, p) => {
  const row = document.createElement('div');
  row.className = 'stl-row';
  const icon = document.createElement('span');
  icon.className = 'stl-icon';
  icon.style.color = accentOf(p, i);
  icon.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="square">' + GLYPHS[i % GLYPHS.length] + '</svg>';
  const label = document.createElement('span');
  label.textContent = step.label;
  row.append(icon, label);
  if (step.detail) {
    const detail = document.createElement('span');
    detail.className = 'stl-detail';
    detail.textContent = '- ' + step.detail;
    row.appendChild(detail);
  }
  list.appendChild(row);
  return { row, label };
};

const paintText = (p) => {
  const key = JSON.stringify([p.heading, p.steps, p.working, p.accent1, p.accent2, p.accent3]);
  if (key === cache.textKey) {
    return;
  }
  heading.textContent = p.heading;
  list.innerHTML = '';
  const rows = parseSteps(p.steps).map((step, i) => rowNode(step, i, p));
  working.innerHTML = '';
  const letters = [...String(p.working || '')].map((ch) => {
    const node = document.createElement('span');
    node.textContent = ch;
    working.appendChild(node);
    return node;
  });
  cache = { ...cache, textKey: key, rows, letters };
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.ink, p.muted, p.lineColor, p.font, p.headingSize, p.stepSize]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--stl-bg', p.background);
  s.setProperty('--stl-ink', p.ink);
  s.setProperty('--stl-muted', p.muted);
  s.setProperty('--stl-line', p.lineColor);
  s.setProperty('--stl-font', fontOf(p.font));
  s.setProperty('--stl-heading', String(p.headingSize));
  s.setProperty('--stl-step', String(p.stepSize));
};

const lineWidth = (node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return Math.max(0, ...[...range.getClientRects()].map((r) => r.width));
};

const hugLines = () => {
  for (const detail of list.querySelectorAll('.stl-detail')) {
    detail.style.width = '';
    detail.style.width = Math.ceil(lineWidth(detail)) + 'px';
  }
};

const place = () => {
  const { width, height } = sizeOf();
  block.style.transform = 'none';
  hugLines();
  const w = block.offsetWidth;
  const h = block.offsetHeight;
  const fit = Math.min(1, (FIT * width) / Math.max(1, w));
  const left = Math.min(LEFT * width, (width - w * fit) / 2);
  block.style.transform = 'translate(' + left + 'px, ' + (TOP * height - (h * fit) / 2) + 'px) scale(' + fit + ')';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  paintLook(p);
  paintText(p);
  place();

  const f = stepsFrame(p, t, duration, cache.rows.length);
  heading.style.opacity = String(f.heading.opacity);
  heading.style.transform = 'translate3d(0, ' + f.heading.rise + 'em, 0)';
  line.style.transform = 'scaleY(' + f.line + ')';
  f.steps.forEach((s, i) => {
    const r = cache.rows[i];
    r.row.style.opacity = String(s.opacity);
    r.row.style.transform = 'translate3d(0, ' + s.rise + 'em, 0)';
    r.label.style.opacity = String(1 - DONE_DIM * (1 - s.current));
  });
  working.style.opacity = String(f.working);
  shimmer(p, t, cache.letters.length).forEach((v, k) => {
    cache.letters[k].style.opacity = String(WORKING_BASE + WORKING_GLOW * v);
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
