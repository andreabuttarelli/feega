export const CIRCLE_EVENT_CSS = String.raw`
.ce {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ce-paper);
  color: var(--ce-ink);
  font-family: var(--ce-font);
  font-weight: var(--ce-weight);
  -webkit-font-smoothing: antialiased;
}

.ce-circle {
  position: absolute;
  border-radius: 50%;
  background: var(--ce-accent);
}

.ce-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ce-ink);
  color: var(--ce-paper);
  letter-spacing: -0.03em;
}

.ce-rule {
  background: var(--ce-accent);
}

.ce-text {
  position: absolute;
  margin: 0;
  white-space: pre;
}

.ce-name,
.ce-title {
  line-height: 0.9;
  letter-spacing: -0.03em;
}

.ce-info {
  line-height: 1.04;
  letter-spacing: -0.035em;
}

.ce-date {
  line-height: 0.94;
  letter-spacing: -0.04em;
}

.ce-body {
  white-space: normal;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.ce-foot {
  position: absolute;
  display: flex;
  flex-direction: column;
}

.ce-accent {
  color: var(--ce-accent);
}
`;

export const CIRCLE_EVENT_VIEW = String.raw`
const MARGIN = 0.055;
const NAME_TOP = 0.012;
const INFO_TOP = 0.072;
const BODY_GAP = 2.2;
const BODY_SIZE = 0.0078;
const BODY_WIDTH = 0.16;
const FOOT_BOTTOM = 0.035;
const DATE_GAP = 0.045;

root.insertAdjacentHTML('beforeend', '<div class="ce"></div>');
const scene = root.querySelector('.ce');

const text = (kind, style, inner) => '<div class="ce-text ' + kind + '" style="' + style + '">' + inner + '</div>';

const titleHtml = (lines) => lines.map((line, i) => (i === lines.length - 1 && lines.length > 1 ? '<span class="ce-accent">' + escaped(line) + '</span>' : escaped(line))).join('\n');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--ce-paper', p.paper);
  s.setProperty('--ce-ink', p.ink);
  s.setProperty('--ce-accent', p.accent);
  s.setProperty('--ce-font', fontOf(p.font));
  s.setProperty('--ce-weight', String(p.fontWeight));

  const px = (v) => (v * width) / 100;
  const margin = MARGIN * width;
  const diameter = px(p.circleSize);
  const circle = '<div class="ce-circle" style="' + box(px(p.circleX) - diameter / 2, (p.circleY * height) / 100 - diameter / 2, diameter, diameter) + '"></div>';

  const name = text('ce-name', 'left:' + margin + 'px;top:' + NAME_TOP * width + 'px;font-size:' + px(p.nameSize) + 'px', escaped(p.heading));

  const infoTop = INFO_TOP * width;
  const infoLines = linesOf(p.info).length;
  const infoX = px(p.infoX);
  const info = text('ce-info', 'left:' + infoX + 'px;top:' + infoTop + 'px;font-size:' + px(p.infoSize) + 'px', escaped(p.info));
  const bodyTop = infoTop + (infoLines + BODY_GAP) * 1.04 * px(p.infoSize);
  const body = text('ce-body', 'left:' + infoX + 'px;top:' + bodyTop + 'px;width:' + BODY_WIDTH * width + 'px;font-size:' + BODY_SIZE * width + 'px', escaped(p.body));

  const markerD = diameter * 0.16;
  const angle = Math.PI * 1.25;
  const mx = px(p.circleX) + Math.cos(angle) * diameter * 0.5 - markerD / 2;
  const my = (p.circleY * height) / 100 + Math.sin(angle) * diameter * 0.5 - markerD / 2;
  const marker = '<div class="ce-marker" style="' + box(mx, my, markerD, markerD) + 'font-size:' + markerD * 0.42 + 'px">' + escaped(p.marker) + '</div>';
  const caption = upright(p.caption, width - margin * 0.75, height - FOOT_BOTTOM * width, BODY_SIZE * width * 1.3, p.ink);
  const rule = '<div class="ce-rule" style="width:' + px(p.dateSize) * 2.2 + 'px;height:' + Math.max(3, width * 0.006) + 'px;margin-bottom:' + width * 0.018 + 'px"></div>';

  const date = text('ce-date', 'position:relative;font-size:' + px(p.dateSize) + 'px;margin-bottom:' + DATE_GAP * width + 'px', escaped(p.date));
  const title = text('ce-title', 'position:relative;font-size:' + px(p.titleSize) + 'px', titleHtml(linesOf(p.title)));
  const foot = '<div class="ce-foot" style="left:' + margin * 0.8 + 'px;bottom:' + FOOT_BOTTOM * width + 'px">' + rule + date + title + '</div>';

  scene.innerHTML = circle + marker + name + info + body + foot + caption;
};
`;
