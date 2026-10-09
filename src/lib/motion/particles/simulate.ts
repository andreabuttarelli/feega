import type { Emitter, ParticleNumberKey, ParticleShape } from './model';

export type Rgb = [number, number, number];

export type ParticleRow = Record<ParticleNumberKey, number> & { start: Rgb; end: Rgb };

export type ParticleBake = { id: string; from: number; fps: number; width: number; height: number; unit: number; seed: number; emitter: `${Emitter}`; shape: `${ParticleShape}`; prewarm: boolean; rows: ParticleRow[] };

export type Particle = { x: number; y: number; size: number; angle: number; r: number; g: number; b: number; alpha: number; softness: number };

export function particlesAt(bake: ParticleBake, t: number): Particle[] {
  const LIMIT = 4000;
  const STILL = 1e-6;
  const TAU = Math.PI * 2;
  const DEGREE = Math.PI / 180;
  const UINT = 4294967296;
  const last = bake.rows.length - 1;
  const rowAt = (f: number) => bake.rows[Math.min(Math.max(Math.floor(f), 0), last)];

  const rand = (n: number, k: number) => {
    let h = Math.imul(bake.seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(k + 0x1b873593, 0x27d4eb2f);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / UINT;
  };
  const signed = (n: number, k: number) => rand(n, k) * 2 - 1;

  const spawn: Record<string, (row: ParticleRow, n: number) => [number, number]> = {
    point: () => [0, 0],
    line: (row, n) => [(signed(n, 1) * row.emitterWidth * bake.width) / 2, 0],
    box: (row, n) => [(signed(n, 1) * row.emitterWidth * bake.width) / 2, (signed(n, 2) * row.emitterHeight * bake.height) / 2],
    ring: (row, n) => {
      const a = rand(n, 1) * TAU;
      return [(Math.cos(a) * row.emitterWidth * bake.width) / 2, (Math.sin(a) * row.emitterHeight * bake.height) / 2];
    }
  };

  const longest = Math.max(...bake.rows.map((row) => row.life * (1 + row.lifeVariance)));
  const reach = Math.ceil(longest * bake.fps) + 1;
  const first = bake.prewarm ? -reach : 0;
  const now = Math.floor(t);
  const out: Particle[] = [];
  let born = 0;

  for (let f = first; f <= now; f++) {
    const row = rowAt(f);
    const perFrame = row.rate / bake.fps;
    const total = born + perFrame;
    if (f < now - reach || perFrame <= 0) {
      born = total;
      continue;
    }
    for (let n = Math.ceil(born); n < total && out.length < LIMIT; n++) {
      const age = (t - (f + (n - born) / perFrame)) / bake.fps;
      const life = row.life * (1 + row.lifeVariance * signed(n, 3));
      if (age < 0 || age >= life) {
        continue;
      }
      const p = age / life;
      const [ox, oy] = spawn[bake.emitter](row, n);
      const heading = (row.direction + row.spread * (rand(n, 4) - 0.5)) * DEGREE;
      const speed = row.speed * (1 + row.speedVariance * signed(n, 5)) * bake.unit;
      const vx = Math.cos(heading) * speed;
      const vy = Math.sin(heading) * speed;
      const gravity = row.gravity * bake.unit;
      const drag = row.drag;
      const decay = drag > STILL ? Math.exp(-drag * age) : 1;
      const travelled = drag > STILL ? (1 - decay) / drag : age;
      const fall = drag > STILL ? (gravity / drag) * (age - travelled) : 0.5 * gravity * age * age;
      const sway = row.wobble * bake.unit * Math.sin(TAU * (row.wobbleRate * age + rand(n, 6)));
      const fallSpeed = drag > STILL ? (gravity / drag) * (1 - decay) : gravity * age;
      const turned = bake.shape === 'streak' ? Math.atan2(vy * decay + fallSpeed, vx * decay) : (rand(n, 8) * 360 + row.spin * age) * DEGREE;
      const mix = (a: number, b: number) => a + (b - a) * p;
      out.push({
        x: row.emitterX * bake.width + ox + vx * travelled + sway,
        y: row.emitterY * bake.height + oy + vy * travelled + fall,
        size: Math.max(0, mix(row.sizeStart, row.sizeEnd) * bake.unit * (1 + row.sizeVariance * signed(n, 7))),
        angle: turned,
        r: mix(row.start[0], row.end[0]),
        g: mix(row.start[1], row.end[1]),
        b: mix(row.start[2], row.end[2]),
        alpha: Math.min(1, Math.max(0, mix(row.opacityStart, row.opacityEnd))),
        softness: row.softness
      });
    }
    born = total;
  }
  return out;
}

type Glow = { sheet: HTMLCanvasElement; x: number; y: number; px: number };

export type GlowTiles = { known: Map<number, Glow>; sheet: HTMLCanvasElement | null; x: number; y: number; row: number; blank: () => HTMLCanvasElement };

export function glowTiles(blank: () => HTMLCanvasElement): GlowTiles {
  return { known: new Map(), sheet: null, x: 0, y: 0, row: 0, blank };
}

export function drawParticles(paint: CanvasRenderingContext2D, particles: Particle[], shape: `${ParticleShape}`, sprite: CanvasImageSource | null, glows: GlowTiles): void {
  const TAU = Math.PI * 2;
  const MIN_GLOW_PX = 4;
  const SHEET_PX = 2048;
  const MAX_GLOW_PX = SHEET_PX / 2;
  const GUTTER_PX = 2;
  const STREAK_LENGTH = 4;
  const STREAK_THICKNESS = 0.35;
  const rgb = (p: Particle, a: number) => `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)},${a})`;

  const freshSheet = () => {
    const sheet = glows.blank();
    sheet.width = SHEET_PX;
    sheet.height = SHEET_PX;
    glows.sheet = sheet;
    glows.x = 0;
    glows.y = 0;
    glows.row = 0;
    return sheet;
  };

  const slotFor = (px: number) => {
    const span = px + GUTTER_PX;
    if (glows.x + span > SHEET_PX) {
      glows.x = 0;
      glows.y += glows.row;
      glows.row = 0;
    }
    const sheet = glows.sheet && glows.y + span <= SHEET_PX ? glows.sheet : freshSheet();
    const slot = { sheet, x: glows.x, y: glows.y, px };
    glows.x += span;
    glows.row = Math.max(glows.row, span);
    return slot;
  };

  const glowOf = (p: Particle, diameter: number) => {
    const px = Math.min(MAX_GLOW_PX, Math.max(MIN_GLOW_PX, 2 ** Math.ceil(Math.log2(diameter))));
    const key = (((Math.round(p.r) * 256 + Math.round(p.g)) * 256 + Math.round(p.b)) * 2 + p.softness) * 65536 + px;
    const known = glows.known.get(key);
    if (known) {
      return known;
    }
    const slot = slotFor(px);
    const half = px / 2;
    const cx = slot.x + half;
    const cy = slot.y + half;
    const sheetPaint = slot.sheet.getContext('2d')!;
    const glow = sheetPaint.createRadialGradient(cx, cy, 0, cx, cy, half);
    glow.addColorStop(0, rgb(p, 1));
    glow.addColorStop(Math.max(0, 1 - p.softness), rgb(p, 1));
    glow.addColorStop(1, rgb(p, 0));
    sheetPaint.fillStyle = glow;
    sheetPaint.beginPath();
    sheetPaint.arc(cx, cy, half, 0, TAU);
    sheetPaint.fill();
    glows.known.set(key, slot);
    return slot;
  };

  let placed = false;
  const place = (p: Particle, scale: number) => {
    const cos = Math.cos(p.angle) * scale;
    const sin = Math.sin(p.angle) * scale;
    paint.setTransform(cos, sin, -sin, cos, p.x, p.y);
    placed = true;
  };
  const unplace = () => {
    if (placed) {
      paint.setTransform(1, 0, 0, 1, 0, 0);
      placed = false;
    }
  };

  const DRAW: Record<string, (p: Particle) => void> = {
    circle: (p) => {
      const radius = p.size / 2;
      if (p.softness <= 0) {
        place(p, 1);
        paint.fillStyle = rgb(p, 1);
        paint.beginPath();
        paint.arc(0, 0, radius, 0, TAU);
        paint.fill();
        return;
      }
      unplace();
      const glow = glowOf(p, p.size);
      paint.drawImage(glow.sheet, glow.x, glow.y, glow.px, glow.px, p.x - radius, p.y - radius, p.size, p.size);
    },
    square: (p) => {
      place(p, 1);
      paint.fillStyle = rgb(p, 1);
      paint.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    },
    triangle: (p) => {
      place(p, 1);
      paint.fillStyle = rgb(p, 1);
      paint.beginPath();
      paint.moveTo(0, -p.size / 2);
      paint.lineTo(p.size / 2, p.size / 2);
      paint.lineTo(-p.size / 2, p.size / 2);
      paint.closePath();
      paint.fill();
    },
    streak: (p) => {
      place(p, 1);
      paint.fillStyle = rgb(p, 1);
      paint.fillRect(-p.size * STREAK_LENGTH, (-p.size * STREAK_THICKNESS) / 2, p.size * STREAK_LENGTH, p.size * STREAK_THICKNESS);
    },
    sprite: (p) => {
      place(p, 1);
      if (sprite) {
        paint.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      }
    }
  };

  paint.clearRect(0, 0, paint.canvas.width, paint.canvas.height);
  let alpha = -1;
  for (const p of particles) {
    if (p.alpha <= 0 || p.size <= 0) {
      continue;
    }
    if (alpha !== p.alpha) {
      alpha = p.alpha;
      paint.globalAlpha = alpha;
    }
    DRAW[shape](p);
  }
  unplace();
  paint.globalAlpha = 1;
}
