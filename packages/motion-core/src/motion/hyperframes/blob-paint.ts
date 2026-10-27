type Matrix = [number, number, number, number, number, number];
type Stop = [number, string];
type Paint = { color: string } | { kind: 'linear' | 'radial'; coords: number[]; stops: Stop[] };
type PathOp = { op: 'path'; d: string; matrix: Matrix; fill: Paint | null; stroke: Paint | null; width: number; rule: string; alpha: number };
type TextOp = { op: 'text'; text: string; font: string; spacing: number; color: string; x: number; y: number; alpha: number };
type BoxOp = { op: 'box'; color: string; x: number; y: number; w: number; h: number; alpha: number };
type PictureOp = { op: 'picture'; source: number; x: number; y: number; w: number; h: number; alpha: number };
export type PaintOp = PathOp | TextOp | BoxOp | PictureOp;
export type PaintPlan = { ops: PaintOp[]; sources: CanvasImageSource[]; key: string };

export function paintPlan(scope: Element, root: Element, width: number, measure: CanvasRenderingContext2D): PaintPlan {
  const base = root.getBoundingClientRect();
  const k = width / base.width;
  const ops: PaintOp[] = [];
  const sources: CanvasImageSource[] = [];
  const alphas = new Map<Element, number>();
  const NONE = ['none', 'transparent', 'rgba(0, 0, 0, 0)'];
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  const alphaOf = (el: Element): number => {
    if (el === scope || !el.parentElement) {
      return 1;
    }
    const known = alphas.get(el);
    if (known !== undefined) {
      return known;
    }
    const own = parseFloat(getComputedStyle(el).opacity);
    const value = (isNaN(own) ? 1 : own) * alphaOf(el.parentElement);
    alphas.set(el, value);
    return value;
  };

  const shown = (el: Element) => {
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  const at = (x: number, y: number) => [(x - base.left) * k, (y - base.top) * k];

  const paintOf = (value: string, path: SVGGraphicsElement): Paint | null => {
    if (NONE.includes(value)) {
      return null;
    }
    const ref = /url\(["']?#([^"')]+)["']?\)/.exec(value);
    if (!ref) {
      return { color: value };
    }
    const grad = document.getElementById(ref[1]);
    if (!grad) {
      return null;
    }
    const stops: Stop[] = [...grad.querySelectorAll('stop')].map((s) => {
      const style = getComputedStyle(s);
      const offset = parseFloat(s.getAttribute('offset') || '0');
      const fraction = String(s.getAttribute('offset') || '').includes('%') ? offset / 100 : offset;
      const opacity = parseFloat(style.stopOpacity || '1');
      const color = style.stopColor;
      return [fraction, opacity >= 1 ? color : color.replace(/rgba?\(([^)]+)\)/, (_, inner) => `rgba(${inner.split(',').slice(0, 3).join(',')},${opacity})`)];
    });
    const user = grad.getAttribute('gradientUnits') === 'userSpaceOnUse';
    const box = user ? { x: 0, y: 0, width: 1, height: 1 } : path.getBBox();
    const num = (name: string, fallback: number) => {
      const raw = grad.getAttribute(name);
      if (raw === null) {
        return fallback;
      }
      return raw.includes('%') ? parseFloat(raw) / 100 : parseFloat(raw);
    };
    const sx = (v: number) => box.x + v * box.width;
    const sy = (v: number) => box.y + v * box.height;
    if (grad.tagName.toLowerCase() === 'lineargradient') {
      return { kind: 'linear', coords: [sx(num('x1', 0)), sy(num('y1', 0)), sx(num('x2', 1)), sy(num('y2', 0))], stops };
    }
    const r = num('r', 0.5) * (user ? 1 : Math.max(box.width, box.height));
    return { kind: 'radial', coords: [sx(num('fx', num('cx', 0.5))), sy(num('fy', num('cy', 0.5))), 0, sx(num('cx', 0.5)), sy(num('cy', 0.5)), r], stops };
  };

  const pathOp = (el: SVGGeometryElement) => {
    const style = getComputedStyle(el);
    const m = el.getScreenCTM();
    if (!m) {
      return;
    }
    const d = el.tagName.toLowerCase() === 'path' ? el.getAttribute('d') || '' : '';
    if (!d) {
      return;
    }
    const [e, f] = at(m.e, m.f);
    ops.push({
      op: 'path',
      d,
      matrix: [m.a * k, m.b * k, m.c * k, m.d * k, e, f],
      fill: paintOf(style.fill, el),
      stroke: paintOf(style.stroke, el),
      width: parseFloat(style.strokeWidth) || 0,
      rule: style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
      alpha: alphaOf(el) * parseFloat(style.fillOpacity || '1')
    });
  };

  const textOps = (node: Text) => {
    const parent = node.parentElement;
    const content = node.textContent || '';
    if (!parent || !content.trim()) {
      return;
    }
    const style = getComputedStyle(parent);
    const range = document.createRange();
    const lines: { start: number; end: number; rect: DOMRect }[] = [];
    for (let i = 0; i < content.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      const last = lines[lines.length - 1];
      if (last && Math.abs(rect.top - last.rect.top) < rect.height / 2) {
        last.end = i + 1;
        continue;
      }
      lines.push({ start: i, end: i + 1, rect });
    }
    const size = parseFloat(style.fontSize);
    measure.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
    const metrics = measure.measureText('Hg');
    const tall = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    for (const line of lines) {
      const text = content.slice(line.start, line.end).replace(/\s+$/, '');
      if (!text) {
        continue;
      }
      const zoom = (line.rect.height / tall) * k;
      const [x, top] = at(line.rect.left, line.rect.top);
      ops.push({
        op: 'text',
        text,
        font: `${style.fontStyle} ${style.fontWeight} ${size * zoom}px ${style.fontFamily}`,
        spacing: (parseFloat(style.letterSpacing) || 0) * zoom,
        color: style.color,
        x,
        y: top + metrics.fontBoundingBoxAscent * zoom,
        alpha: alphaOf(parent)
      });
    }
  };

  const boxOp = (el: HTMLElement) => {
    const color = getComputedStyle(el).backgroundColor;
    if (!color || color === TRANSPARENT) {
      return;
    }
    const r = el.getBoundingClientRect();
    const [x, y] = at(r.left, r.top);
    ops.push({ op: 'box', color, x, y, w: r.width * k, h: r.height * k, alpha: alphaOf(el) });
  };

  const pictureOp = (el: HTMLImageElement | HTMLCanvasElement) => {
    const r = el.getBoundingClientRect();
    const [x, y] = at(r.left, r.top);
    sources.push(el);
    ops.push({ op: 'picture', source: sources.length - 1, x, y, w: r.width * k, h: r.height * k, alpha: alphaOf(el) });
  };

  const visit = (el: Element) => {
    if (!shown(el)) {
      return;
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'script' || tag === 'style' || tag === 'filter') {
      return;
    }
    if (tag === 'path') {
      pathOp(el as SVGGeometryElement);
      return;
    }
    if (tag === 'img' || tag === 'canvas') {
      pictureOp(el as HTMLImageElement);
      return;
    }
    if (el instanceof HTMLElement) {
      boxOp(el);
    }
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        textOps(child as Text);
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child as Element);
      }
    }
  };

  [...scope.children].forEach(visit);
  return { ops, sources, key: JSON.stringify(ops) };
}

export function paintOps(g: CanvasRenderingContext2D, plan: PaintPlan): void {
  const style = (p: { color: string } | { kind: 'linear' | 'radial'; coords: number[]; stops: Stop[] }) => {
    if ('color' in p) {
      return p.color;
    }
    const c = p.coords;
    const grad = p.kind === 'linear' ? g.createLinearGradient(c[0], c[1], c[2], c[3]) : g.createRadialGradient(c[0], c[1], c[2], c[3], c[4], c[5]);
    p.stops.forEach(([at, color]) => grad.addColorStop(Math.min(Math.max(at, 0), 1), color));
    return grad;
  };
  const draw = {
    path: (o: PathOp) => {
      g.setTransform(...o.matrix);
      const shape = new Path2D(o.d);
      if (o.fill) {
        g.fillStyle = style(o.fill);
        g.fill(shape, o.rule as CanvasFillRule);
      }
      if (o.stroke && o.width > 0) {
        g.strokeStyle = style(o.stroke);
        g.lineWidth = o.width;
        g.stroke(shape);
      }
    },
    text: (o: TextOp) => {
      g.font = o.font;
      g.letterSpacing = `${o.spacing}px`;
      g.fillStyle = o.color;
      g.textBaseline = 'alphabetic';
      g.fillText(o.text, o.x, o.y);
    },
    box: (o: BoxOp) => {
      g.fillStyle = o.color;
      g.fillRect(o.x, o.y, o.w, o.h);
    },
    picture: (o: PictureOp) => {
      try {
        g.drawImage(plan.sources[o.source], o.x, o.y, o.w, o.h);
      } catch {
        return;
      }
    }
  };
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  for (const o of plan.ops) {
    g.save();
    g.globalAlpha = Math.min(Math.max(o.alpha, 0), 1);
    (draw[o.op] as (o: PaintOp) => void)(o);
    g.restore();
  }
}
