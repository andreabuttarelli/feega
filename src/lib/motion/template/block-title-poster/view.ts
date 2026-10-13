const SPECKS =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 10 -7.4'/></filter><rect width='360' height='360' filter='url(%23s)'/></svg>";

const SCRATCHES =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900' fill='none' stroke='white' stroke-linecap='round' stroke-opacity='0.7'><path d='M60 120 L380 40' stroke-width='1.2'/><path d='M520 300 L860 260' stroke-width='0.8'/><path d='M140 520 L300 760' stroke-width='1'/><path d='M640 620 L820 880' stroke-width='0.7'/><path d='M40 820 L420 700' stroke-width='0.9'/><path d='M700 80 L560 240' stroke-width='0.8'/><path d='M260 300 L330 330' stroke-width='1.4'/><path d='M420 470 L760 430' stroke-width='0.6'/><path d='M90 400 L120 460' stroke-width='1.6'/><path d='M600 520 L610 590' stroke-width='1.2'/><path d='M300 880 L520 840' stroke-width='0.8'/><path d='M820 380 L880 520' stroke-width='1'/></svg>";

export const BLOCK_TITLE_CSS = String.raw`
.bt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bt-paper);
  color: var(--bt-ink);
  font-family: var(--bt-text-font);
  -webkit-font-smoothing: antialiased;
}

.bt-wear {
  position: absolute;
  inset: 0;
  background-image: var(--bt-wear-image);
  background-size: 30%, 85%;
  opacity: var(--bt-wear);
  pointer-events: none;
}

.bt-byline {
  position: absolute;
  margin: 0;
  font-weight: 600;
  letter-spacing: -0.03em;
  white-space: pre;
}

.bt-title {
  position: absolute;
  margin: 0;
  font-family: var(--bt-font);
  font-weight: var(--bt-weight);
  letter-spacing: -0.035em;
  white-space: pre;
}

.bt-block {
  position: absolute;
  background: var(--bt-block);
}

.bt-foot {
  position: absolute;
}

.bt-names {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.2;
  white-space: nowrap;
}

.bt-rule {
  background: var(--bt-ink);
}

.bt-body {
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.bt-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  font-family: var(--bt-font);
  font-weight: var(--bt-weight);
  letter-spacing: -0.035em;
}
`;

export const BLOCK_TITLE_VIEW = String.raw`
const WEAR = ${JSON.stringify(`url("${SPECKS}"), url("${SCRATCHES}")`)};
const PROBE_PX = 100;
const MARGIN = 0.05;
const BYLINE_TOP = 0.045;
const TITLE_GAP = 0.6;
const BLOCK_GAP = 0.045;
const FOOT_BOTTOM = 0.065;
const RULE = 0.0045;
const RULE_GAP = 0.012;
const BODY_GAP = 0.03;

root.insertAdjacentHTML('beforeend', '<div class="bt"></div>');
const scene = root.querySelector('.bt');

const widestEm = (probe, lines) =>
  lines.reduce((m, line) => {
    probe.textContent = line;
    return Math.max(m, probe.getBoundingClientRect().width / PROBE_PX);
  }, 1e-6);

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--bt-paper', p.paper);
  s.setProperty('--bt-ink', p.ink);
  s.setProperty('--bt-block', p.block);
  s.setProperty('--bt-font', fontOf(p.font));
  s.setProperty('--bt-text-font', fontOf(p.textFont));
  s.setProperty('--bt-weight', String(p.fontWeight));
  s.setProperty('--bt-wear', String(p.wear));
  s.setProperty('--bt-wear-image', WEAR);

  const px = (v) => (v * width) / 100;
  const margin = MARGIN * width;
  const room = width - 2 * margin;
  const names = linesOf(p.names).filter((n) => n.trim());
  const lines = linesOf(p.title).filter((l) => l.trim());

  scene.innerHTML = '<span class="bt-probe" style="font-size:' + PROBE_PX + 'px"></span>';
  const size = (room * p.fill) / widestEm(scene.firstChild, lines);
  const step = size * p.leading;

  const bylineSize = px(p.bylineSize);
  const bylineTop = BYLINE_TOP * width;
  const titleTop = bylineTop + bylineSize * (1 + TITLE_GAP);
  const lastBaseline = titleTop + step * (lines.length - 1) + size * 0.95;
  const blockTop = lastBaseline - p.overlap * size;

  const namesHtml = '<div class="bt-names" style="font-size:' + px(p.namesSize) + 'px">' + names.map((n) => '<span>' + escaped(n) + '</span>').join('') + '</div>';
  const rule = '<div class="bt-rule" style="height:' + Math.max(2, RULE * width) + 'px;margin:' + RULE_GAP * width + 'px 0 ' + BODY_GAP * width + 'px"></div>';
  const body = '<p class="bt-body" style="font-size:' + px(p.bodySize) + 'px">' + escaped(p.body) + '</p>';
  const foot = '<div class="bt-foot" style="left:' + margin + 'px;width:' + room + 'px;bottom:' + FOOT_BOTTOM * width + 'px">' + namesHtml + rule + body + '</div>';

  const byline = '<div class="bt-byline" style="left:' + margin + 'px;top:' + bylineTop + 'px;font-size:' + bylineSize + 'px">' + escaped(p.byline) + '</div>';
  const title = '<div class="bt-title" style="left:' + margin + 'px;top:' + titleTop + 'px;font-size:' + size + 'px;line-height:' + p.leading + '">' + escaped(lines.join('\n')) + '</div>';

  scene.innerHTML = foot + byline + '<div class="bt-block"></div>' + title + '<div class="bt-wear"></div>';
  const footTop = scene.querySelector('.bt-foot').offsetTop;
  scene.querySelector('.bt-block').style.cssText = box(margin, blockTop, room, Math.max(0, footTop - BLOCK_GAP * width - blockTop));
};
`;
