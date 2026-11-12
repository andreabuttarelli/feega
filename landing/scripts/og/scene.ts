import { INK, PLANE, SHADES, onTop, project, slab, type Box, type Shade } from '../../src/lib/site/iso/iso';
import { envelope, fieldAt, glyphFor } from '../../src/lib/site/ascii-field';

export const TextBand = { On: 'on', Off: 'off' } as const;
export type TextBand = (typeof TextBand)[keyof typeof TextBand];

type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  w: number;
  h: number;
  text: TextBand;
  copy: { x: number; y: number; gap: number };
  lockup: { h: number };
  statement: { text: string; size: number; width: number };
  scene: Rect;
  box?: Rect;
};

type Span = readonly [number, number];

export const LOOP_SECONDS = 10;
export const STILL_AT = 9.3;

const PHASES = {
  mark: [0, 2],
  markOut: [2, 2.5],
  plane: [2.2, 3],
  design: [3, 4.8],
  motion: [4.8, 6.6],
  generate: [6.6, 8.4],
  outro: [8.4, 9],
  fade: [9.5, 10]
} as const satisfies Record<string, Span>;

const CHAPTERS = [
  { phase: PHASES.design, eyebrow: 'Code → Design → Code', heading: 'Design directly in your codebase' },
  { phase: PHASES.motion, eyebrow: 'Layout → Timeline → Video', heading: 'Animate any layout' },
  { phase: PHASES.generate, eyebrow: 'Prompt → Nodes → Assets', heading: 'Generate on the canvas' }
];

const CHAPTER_FADE = 0.3;
const DRIFT = 16;
const GRID = 30;
const GRID_REACH = 26;
const LIFT = 56;
const DROP = 34;
const NODE_T = 4;

const CODE: Box = { x: -101, y: 92, w: 150, d: 110, t: 6 };
const UI: Box = { x: -89, y: 104, w: 126, d: 86, t: NODE_T };
const FRAME: Box = { x: 135, y: 155, w: 112, d: 84, t: NODE_T };
const TIMELINE: Box = { x: 135, y: 253, w: 112, d: 28, t: 3 };
const RENDER: Box = { x: 273, y: 181, w: 74, d: 58, t: NODE_T };
const PROMPT: Box = { x: 29, y: -77, w: 92, d: 62, t: NODE_T };
const IMAGE: Box = { x: 161, y: -135, w: 76, d: 60, t: NODE_T };
const CLIP: Box = { x: 171, y: -41, w: 76, d: 60, t: NODE_T };

const BOXES = [CODE, FRAME, TIMELINE, RENDER, PROMPT, IMAGE, CLIP];

const CODE_LINES: [number, number][] = [
  [0, 70],
  [10, 96],
  [10, 54],
  [20, 82],
  [20, 60],
  [10, 40],
  [0, 30]
];
const TOKEN_ROW = 2;
const KEYFRAMES = [0, 0.45, 1];
const PROMPT_LINES = [66, 52, 34];

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => (n < 0.5 ? 4 * n ** 3 : 1 - (-2 * n + 2) ** 3 / 2);
const progress = ([from, to]: Span, t: number) => ease(clamp((t - from) / (to - from)));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const fmt = (n: number) => Number(n.toFixed(2));

function sceneBounds() {
  const corners = BOXES.flatMap(({ x, y, w, d, t }) =>
    [
      [x, y, t],
      [x + w, y, t],
      [x, y + d, t],
      [x + w, y + d, t],
      [x, y + d, 0],
      [x + w, y, 0],
      [x + w, y + d, 0]
    ].map(([px, py, pz]) => project(px, py, pz))
  );
  const xs = corners.map(([px]) => px);
  const ys = corners.map(([, py]) => py);
  return { x: Math.min(...xs), y: Math.min(...ys) - LIFT, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) + LIFT };
}

const BOUNDS = sceneBounds();

function tile(box: Box, shade: Shade, inner = '', lift = 0, opacity = 1) {
  const f = slab(box);
  const top = inner ? `<g transform="${onTop(box.x, box.y, box.t)}">${inner}</g>` : '';
  return `<g transform="translate(0 ${fmt(-lift)})" opacity="${fmt(opacity)}"><g stroke="${shade.line}" stroke-width="0.6" stroke-linejoin="round"><polygon points="${f.left}" fill="${shade.left}"/><polygon points="${f.right}" fill="${shade.right}"/><polygon points="${f.top}" fill="${shade.top}"/></g>${top}</g>`;
}

const bar = (x: number, y: number, w: number, h: number, fill: string, opacity = 1) =>
  `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(Math.max(0, w))}" height="${h}" rx="${h / 2}" fill="${fill}" opacity="${fmt(opacity)}"/>`;

function grid(opacity: number) {
  const reach = GRID * GRID_REACH;
  const lines = Array.from({ length: GRID_REACH * 2 + 1 }, (_, i) => (i - GRID_REACH) * GRID)
    .map((k) => `M${k} ${-reach}V${reach}M${-reach} ${k}H${reach}`)
    .join('');
  const [cx, cy] = [(PROMPT.x + CODE.x) / 2 + 60, (PROMPT.y + CODE.y) / 2 + 30];
  return `<g opacity="${fmt(opacity)}" mask="url(#fade)"><g transform="translate(${project(cx, cy).join(' ')}) ${PLANE}"><path d="${lines}" fill="none" stroke="${INK.dark}" stroke-opacity="0.09" stroke-width="1" vector-effect="non-scaling-stroke"/></g></g>`;
}

function wire(d: string, drawn: number, accent: boolean) {
  const stroke = accent ? INK.accent : INK.dark;
  return `<path d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${fmt(1 - drawn)}" fill="none" stroke="${stroke}" stroke-opacity="${accent ? 1 : 0.5}" stroke-width="1.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
}

function wires(t: number, plane: number) {
  const design = progress(PHASES.design, t);
  const motion = progress(PHASES.motion, t);
  const generate = progress(PHASES.generate, t);
  const codeOut = `M${CODE.x + CODE.w} ${CODE.y + 70}C${CODE.x + CODE.w + 40} ${CODE.y + 70} ${FRAME.x - 40} ${FRAME.y + 42} ${FRAME.x} ${FRAME.y + 42}`;
  const frameOut = `M${FRAME.x + FRAME.w} ${FRAME.y + 50}C${FRAME.x + FRAME.w + 14} ${FRAME.y + 50} ${RENDER.x - 14} ${RENDER.y + 26} ${RENDER.x} ${RENDER.y + 26}`;
  const toImage = `M${PROMPT.x + PROMPT.w} ${PROMPT.y + 20}C${PROMPT.x + PROMPT.w + 24} ${PROMPT.y + 20} ${IMAGE.x - 24} ${IMAGE.y + 30} ${IMAGE.x} ${IMAGE.y + 30}`;
  const toClip = `M${PROMPT.x + PROMPT.w} ${PROMPT.y + 44}C${PROMPT.x + PROMPT.w + 24} ${PROMPT.y + 44} ${CLIP.x - 24} ${CLIP.y + 30} ${CLIP.x} ${CLIP.y + 30}`;
  const renderOut = `M${RENDER.x + RENDER.w / 2} ${RENDER.y}C${RENDER.x + RENDER.w / 2} ${RENDER.y - 30} ${PROMPT.x + PROMPT.w / 2} ${PROMPT.y + PROMPT.d + 30} ${PROMPT.x + PROMPT.w / 2} ${PROMPT.y + PROMPT.d}`;
  const paths = [
    wire(renderOut, clamp(generate * 3), false),
    wire(codeOut, design, false),
    wire(frameOut, clamp(motion * 1.4 - 0.2), false),
    wire(toImage, clamp(generate * 2.2 - 0.5), generate > 0 && generate < 1),
    wire(toClip, clamp(generate * 2.2 - 0.8), generate > 0 && generate < 1)
  ].join('');
  return `<g opacity="${fmt(plane)}" transform="${PLANE}">${paths}</g>`;
}

function designVignette(t: number) {
  const p = progress(PHASES.design, t);
  const rows = CODE_LINES.map(([indent, width], i) =>
    i === TOKEN_ROW
      ? bar(10 + indent, 16 + i * 13, width, 4, INK.accent, 0.35 + 0.65 * p)
      : bar(10 + indent, 16 + i * 13, width, 4, INK.dark, 0.35)
  ).join('');
  const code = tile(CODE, SHADES.code, rows);
  const lift = LIFT * p;
  const beams = [
    [UI.x, UI.y],
    [UI.x + UI.w, UI.y],
    [UI.x + UI.w, UI.y + UI.d],
    [UI.x, UI.y + UI.d]
  ]
    .map(([x, y]) => {
      const [x1, y1] = project(x, y, CODE.t);
      return `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${fmt(y1 - lift)}"/>`;
    })
    .join('');
  const ui = [
    `<circle cx="10" cy="9" r="3" fill="${INK.accent}"/>`,
    bar(84, 7.5, 12, 3, INK.light, 0.5),
    bar(100, 7.5, 12, 3, INK.light, 0.5),
    bar(12, 24, 78, 7, INK.light),
    bar(12, 35, 54, 7, INK.light),
    bar(12, 48, 64, 3, INK.light, 0.45),
    bar(12, 60, 30, 10, INK.accent),
    `<rect x="84" y="24" width="30" height="46" rx="2" fill="#dcd7cd"/>`
  ].join('');
  const shown = clamp(p * 3);
  return `${code}<g stroke="${INK.accent}" stroke-width="0.8" stroke-dasharray="2 2" opacity="${fmt(0.7 * shown)}">${beams}</g>${tile(UI, SHADES.paper, ui, CODE.t + lift - UI.t + 1, shown)}`;
}

function motionVignette(t: number) {
  const p = progress(PHASES.motion, t);
  const done = p >= 1;
  const travel = FRAME.w - 40;
  const at = clamp(p * 1.15);
  const square = `<rect x="${fmt(14 + travel * at)}" y="${fmt(52 - 26 * Math.sin(at * Math.PI))}" width="16" height="16" rx="2" fill="${INK.accent}"/>`;
  const frame = tile(FRAME, SHADES.card, [bar(10, 8, 30, 3, INK.light, 0.6), bar(10, 14, 50, 3, INK.light, 0.3), square].join(''));
  const track = TIMELINE.w - 20;
  const keys = KEYFRAMES.map((k) => {
    const x = 10 + track * k;
    const lit = at >= k;
    return `<rect x="${fmt(x - 3.5)}" y="10.5" width="7" height="7" transform="rotate(45 ${fmt(x)} 14)" fill="${lit ? INK.accent : INK.dark}" opacity="${lit ? 1 : 0.5}"/>`;
  }).join('');
  const playhead = `<rect x="${fmt(10 + track * at - 0.8)}" y="3" width="1.6" height="22" fill="${INK.accent}"/>`;
  const timeline = tile(TIMELINE, SHADES.night, [bar(10, 13, track, 2, INK.dark, 0.25), keys, playhead].join(''));
  const rendered = clamp((p - 0.7) / 0.3);
  const screen = `<rect x="8" y="8" width="${RENDER.w - 16}" height="${RENDER.d - 22}" rx="2" fill="#000"/>`;
  const play = `<path d="M${RENDER.w / 2 - 6} 18l13 9l-13 9z" fill="${rendered > 0 ? INK.accent : INK.dark}" opacity="${fmt(0.4 + 0.6 * rendered)}"/>`;
  const progressBar = bar(8, RENDER.d - 9, (RENDER.w - 16) * (done ? 1 : rendered), 2, INK.accent);
  return `${frame}${tile(RENDER, SHADES.code, screen + play + progressBar)}${timeline}`;
}

function generateVignette(t: number) {
  const p = progress(PHASES.generate, t);
  const typed = clamp(p * 2.5);
  const lines = PROMPT_LINES.map((width, i) => bar(10, 20 + i * 10, width * clamp(typed * PROMPT_LINES.length - i), 5, INK.light)).join('');
  const caretX = 10 + PROMPT_LINES[PROMPT_LINES.length - 1] * clamp(typed * PROMPT_LINES.length - 2);
  const prompt = tile(PROMPT, SHADES.card, `${bar(10, 8, 26, 3, INK.light, 0.6)}${lines}<rect x="${fmt(caretX + 2)}" y="39" width="2" height="9" fill="${INK.accent}"/>`);
  const imageLanded = clamp((p - 0.5) / 0.3);
  const clipLanded = clamp((p - 0.68) / 0.3);
  const empty = (box: Box) => tile(box, SHADES.card, `${bar(8, 7, 24, 3, INK.light, 0.6)}<rect x="8" y="16" width="${box.w - 16}" height="${box.d - 24}" rx="2" fill="#dcd7cd"/>`);
  const image = `<g transform="translate(0 ${fmt(-DROP * (1 - ease(imageLanded)))})" opacity="${fmt(imageLanded)}"><g transform="${onTop(IMAGE.x, IMAGE.y, IMAGE.t)}"><rect x="8" y="16" width="${IMAGE.w - 16}" height="${IMAGE.d - 24}" rx="2" fill="#bdb7ac"/><path d="M12 ${IMAGE.d - 10}l18-18l12 12l9-8l17 14z" fill="#8f897f"/><circle cx="${IMAGE.w - 20}" cy="25" r="5" fill="${INK.accent}"/></g></g>`;
  const clip = `<g transform="translate(0 ${fmt(-DROP * (1 - ease(clipLanded)))})" opacity="${fmt(clipLanded)}"><g transform="${onTop(CLIP.x, CLIP.y, CLIP.t)}"><rect x="8" y="16" width="${CLIP.w - 16}" height="${CLIP.d - 24}" rx="2" fill="${INK.light}"/><path d="M${CLIP.w / 2 - 5} 24l11 8l-11 8z" fill="${INK.accent}"/></g></g>`;
  return `${empty(IMAGE)}${image}${prompt}${empty(CLIP)}${clip}`;
}

const ASCII_CELL = 14;
const ASCII_SCALE = 0.09;
const ASCII_FLOOR = 0.6;
const ASCII_ACCENT = [255, 81, 0];
const ASCII_NEUTRAL = [120, 116, 110];

function asciiBox(box: Rect) {
  const cols = Math.ceil(box.w / ASCII_CELL);
  const rows = Math.ceil(box.h / ASCII_CELL);
  const cells = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const e = envelope((c + 0.5) / cols, (r + 0.5) / rows);
      const d = Math.sqrt(fieldAt(c * ASCII_CELL * ASCII_SCALE, r * ASCII_CELL * ASCII_SCALE, 0)) * (ASCII_FLOOR + (1 - ASCII_FLOOR) * e);
      const glyph = glyphFor(d);
      if (glyph === ' ') {
        continue;
      }

      const [red, green, blue] = ASCII_ACCENT.map((v, k) => v + (ASCII_NEUTRAL[k] - v) * (1 - e));
      cells.push(`<text x="${c * ASCII_CELL + ASCII_CELL / 2}" y="${r * ASCII_CELL + ASCII_CELL / 2}" fill="rgb(${Math.round(red)},${Math.round(green)},${Math.round(blue)})" opacity="${fmt(0.3 + d * 0.45)}">${glyph.replace('&', '&amp;')}</text>`);
    }
  }

  return `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"><rect width="${box.w}" height="${box.h}" rx="12" fill="#0d0d0d"/><g opacity="0.7" font-family="ui-monospace, Menlo, monospace" font-size="${ASCII_CELL}" text-anchor="middle" dominant-baseline="middle">${cells.join('')}</g></svg>`;
}

function sceneSvg(layout: Layout, t: number) {
  const plane = progress(PHASES.plane, t);
  const fit = Math.min(layout.scene.w / BOUNDS.w, layout.scene.h / BOUNDS.h);
  const drift = lerp(DRIFT, -DRIFT, clamp(t / LOOP_SECONDS));
  const ox = layout.scene.x + (layout.scene.w - BOUNDS.w * fit) / 2 - BOUNDS.x * fit + drift;
  const oy = layout.scene.y + (layout.scene.h - BOUNDS.h * fit) / 2 - BOUNDS.y * fit + drift * 0.3;
  const rise = lerp(18, 0, plane);
  const body = [designVignette(t), generateVignette(t), motionVignette(t)].join('');
  const fadeCenter = [((layout.scene.x + layout.scene.w / 2) / layout.w) * 100, ((layout.scene.y + layout.scene.h / 2) / layout.h) * 100];
  return `<svg class="scene" width="${layout.w}" height="${layout.h}" viewBox="0 0 ${layout.w} ${layout.h}">
<defs><radialGradient id="fadeGradient" cx="${fmt(fadeCenter[0])}%" cy="${fmt(fadeCenter[1])}%" r="60%"><stop offset="0.25" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="fade" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#fadeGradient)"/></mask></defs>
${layout.box ? `<g opacity="${fmt(plane)}">${asciiBox(layout.box)}</g>` : ''}<g transform="translate(${fmt(ox)} ${fmt(oy + rise)}) scale(${fmt(fit)})">${grid(plane)}${wires(t, plane)}<g opacity="${fmt(plane)}">${body}</g></g></svg>`;
}

function chapterOpacity(phase: Span, t: number) {
  const [from, to] = phase;
  return clamp(Math.min((t - from) / CHAPTER_FADE, (to - t) / CHAPTER_FADE));
}

const EYEBROW_SCALE = 0.3;

function band(layout: Layout, t: number, lockup: string) {
  if (layout.text === TextBand.Off) {
    return '';
  }

  const { x, y, gap } = layout.copy;
  const { text, size, width } = layout.statement;
  const outro = progress(PHASES.outro, t);
  const chapters = CHAPTERS.map(({ phase, eyebrow, heading }) => {
    const opacity = chapterOpacity(phase, t);
    return opacity > 0
      ? `<div class="chapter" style="opacity:${fmt(opacity)}"><p class="eyebrow" style="font-size:${fmt(size * EYEBROW_SCALE)}px">${eyebrow}</p><p class="statement" style="font-size:${size}px">${heading}</p></div>`
      : '';
  }).join('');
  const brand = `<div class="lockup" style="height:${layout.lockup.h}px;opacity:${fmt(progress(PHASES.plane, t))}">${lockup}</div>`;
  const statement = `<p class="statement" style="font-size:${size}px;transform:translateY(${fmt(lerp(10, 0, outro))}px);opacity:${fmt(outro)}">${text}</p>`;
  return `<div class="copy" style="left:${x}px;top:${y}px;gap:${gap}px;width:${width}px">${brand}<div class="slot">${chapters}${statement}</div></div>`;
}

export type Frame = { html: string; mark: { opacity: number; scale: number; ms: number }; black: number };

export function frame(layout: Layout, t: number, lockup: string): Frame {
  const markOut = progress(PHASES.markOut, t);
  const markOn = layout.text === TextBand.On && t < PHASES.markOut[1];
  return {
    html: sceneSvg(layout, t) + band(layout, t, lockup),
    mark: { opacity: markOn ? 1 - markOut : 0, scale: lerp(1, 0.7, markOut), ms: Math.min(t, PHASES.mark[1]) * 1000 },
    black: progress(PHASES.fade, t)
  };
}
