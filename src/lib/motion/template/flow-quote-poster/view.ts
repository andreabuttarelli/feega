export const FLOW_QUOTE_CSS = String.raw`
.fq {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--fq-paper);
  -webkit-font-smoothing: antialiased;
}

.fq-layer {
  position: absolute;
  inset: 0;
}

.fq-pill {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fq-pill-text {
  position: relative;
  white-space: pre;
  line-height: 1;
  font-weight: 700;
}

.fq-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  font-weight: 600;
}

.fq-index {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
`;

export const FLOW_QUOTE_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="fq"></div>');
const scene = root.querySelector('.fq');

const pill = (x, y, w, h, fill, textColor, font, size, value, tag) =>
  '<div class="fq-pill"' + tag + ' style="' + box(x, y, w, h) + '"><svg width="' + w + '" height="' + h + '" style="position:absolute;inset:0"><rect width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="' + fill + '"/></svg><span class="fq-pill-text" style="color:' + textColor + ';font-family:' + fontOf(font) + ';font-size:' + size + 'px">' + escaped(value) + '</span></div>';

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--fq-paper', p.paper);

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;

  const rows = linesOf(p.pills).filter((l) => l.trim()).map((l) => {
    const [text, x, y, w] = l.split('|').map((t) => t.trim());
    return { text, x: Number(x), y: Number(y), w: Number(w) };
  });
  const h = X(p.pillsHeight);
  const boxes = rows.map((r) => ({ x: X(r.x), y: Y(r.y), w: X(r.w), h }));

  const pills = rows.map((r, i) => pill(boxes[i].x, boxes[i].y, boxes[i].w, h, p.pillsColor, p.pillsTextColor, p.pillsFont, h * 0.42, r.text, part('pills', i))).join('');

  const thick = X(p.connectorWidth);
  const joint = (cx, cy, colour) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + thick * 0.62 + '" fill="' + colour + '"/>';
  const bar = (x1, y1, x2, y2, colour) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + colour + '" stroke-width="' + thick + '" stroke-linecap="square"/>';

  const connect = (a, b) => {
    const acx = a.x + a.w / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const dx = bcx - acx;
    const dy = bcy - acy;
    if (Math.abs(dx) > Math.abs(dy)) {
      const start = { x: a.x + (dx > 0 ? a.w : 0), y: acy };
      const end = { x: b.x + (dx > 0 ? 0 : b.w), y: bcy };
      const bend = { x: end.x, y: start.y };
      return bar(start.x, start.y, bend.x, bend.y, p.connectorColor) + bar(bend.x, bend.y, end.x, end.y, p.connectorColor) + joint(bend.x, bend.y, p.connectorColor);
    }
    const start = { x: acx, y: a.y + (dy > 0 ? a.h : 0) };
    const end = { x: bcx, y: b.y + (dy > 0 ? 0 : b.h) };
    const bend = { x: start.x, y: end.y };
    return bar(start.x, start.y, bend.x, bend.y, p.connectorColor) + bar(bend.x, bend.y, end.x, end.y, p.connectorColor) + joint(bend.x, bend.y, p.connectorColor);
  };

  let links = '';
  for (let i = 1; i < boxes.length; i++) {
    if (i === p.authorFrom) {
      continue;
    }
    links += connect(boxes[i - 1], boxes[i]);
  }
  const art = '<svg class="fq-layer" width="' + width + '" height="' + height + '">' + links + '</svg>';

  const markerPx = X(p.markerSize);
  const marker = '<div class="fq-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-family:' + fontOf(p.markerFont) + ';font-size:' + markerPx * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const indexPx = X(p.indexSize);
  const indexW = indexPx * 3.4;
  const index = '<div class="fq-index"' + part('index') + ' style="' + box(X(p.indexX), Y(p.indexY), indexW, indexPx) + 'background:' + p.indexColor + ';color:' + p.paper + ';font-family:' + fontOf(p.indexFont) + ';font-size:' + indexPx * 0.5 + 'px"><svg width="' + indexW + '" height="' + indexPx + '" style="position:absolute;inset:0"><rect width="' + indexW + '" height="' + indexPx + '" rx="' + indexPx / 2 + '" fill="' + p.indexColor + '"/></svg><span style="position:relative">' + escaped(p.index) + '</span></div>';

  scene.innerHTML = art + pills + marker + index;

  for (const el of scene.querySelectorAll('.fq-pill-text')) {
    const room = el.parentElement.offsetWidth * 0.86;
    if (el.scrollWidth > room) {
      el.style.fontSize = (parseFloat(el.style.fontSize) * room) / el.scrollWidth + 'px';
    }
  }
};
`;
