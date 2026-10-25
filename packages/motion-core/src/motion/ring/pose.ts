import type { RingNumberKey } from '../../canvas/composition/ring';

export type RingRow = Record<RingNumberKey, number>;

export type RingBake = {
  id: string;
  from: number;
  trim: number;
  fps: number;
  width: number;
  height: number;
  unit: number;
  count: number;
  slices: number;
  loopFrames: number;
  turns: number;
  direction: 1 | -1;
  content: { width: number; height: number };
  rows: RingRow[];
};

export type SlicePose = { transform: string; width: number; height: number; offset: number; fade: number; shade: number; blur: number; mirror: boolean; corners: string };

export type RingPose = {
  perspective: number;
  origin: string;
  tilt: string;
  spin: string;
  shadow: { transform: string; size: number; opacity: number };
  card: { width: number; height: number };
  cover: { scale: number; x: number; y: number };
  slices: SlicePose[];
};

export function ringAt(bake: RingBake, frame: number): RingPose {
  const DEGREE = Math.PI / 180;
  const OVERLAP_PX = 2;
  const MAX_GAP_SHARE = 0.9;
  const FACING_SHARPNESS = 3;
  const SHADOW_DROP = 0.15;
  const BACK_SHADE = 0.6;
  const SHADOW_SPREAD = 2.6;
  const PRECISION = 1000;
  const round = (v: number) => Math.round(v * PRECISION) / PRECISION;

  const clipFrame = frame - bake.from;
  const local = Math.max(0, clipFrame + bake.trim);
  const row = bake.rows[Math.min(Math.max(Math.floor(clipFrame), 0), bake.rows.length - 1)];
  const radius = row.ringRadius * bake.unit;
  const height = row.cardHeight * bake.unit;
  const pitch = (Math.PI * 2) / bake.count;
  const gapAngle = Math.min((row.gap * bake.unit) / radius, pitch * MAX_GAP_SHARE);
  const arc = pitch - gapAngle;
  const cardWidth = radius * arc;
  const sliceAngle = arc / bake.slices;
  const sliceWidth = 2 * radius * Math.sin(sliceAngle / 2) + OVERLAP_PX;
  const phase = (local % bake.loopFrames) / bake.loopFrames;
  const angle = bake.direction * 360 * bake.turns * phase + row.spin;

  const tx = row.tiltX * DEGREE;
  const tz = row.tiltZ * DEGREE;
  const camera = { x: 0, y: -row.cameraHeight * bake.height, z: row.cameraDistance };
  const world = (x: number, y: number, z: number) => {
    const zx = x * Math.cos(tz) - y * Math.sin(tz);
    const zy = x * Math.sin(tz) + y * Math.cos(tz);
    return { x: zx, y: zy * Math.cos(tx) - z * Math.sin(tx), z: zy * Math.sin(tx) + z * Math.cos(tx) };
  };

  const facingAt = (theta: number) => {
    const phi = theta + angle * DEGREE;
    const normal = world(Math.sin(phi), 0, Math.cos(phi));
    const at = world(radius * Math.sin(phi), 0, radius * Math.cos(phi));
    const toCamera = { x: camera.x - at.x, y: camera.y - at.y, z: camera.z - at.z };
    const length = Math.hypot(toCamera.x, toCamera.y, toCamera.z) || 1;
    return (normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z) / length;
  };

  const corner = round(Math.min(row.cornerRadius, sliceWidth, height / 2));
  const last = bake.slices - 1;
  const cornersOf = (s: number) => {
    if (!corner || (s > 0 && s < last)) {
      return '0';
    }
    if (last === 0) {
      return `${corner}px`;
    }
    return s === 0 ? `${corner}px 0 0 ${corner}px` : `0 ${corner}px ${corner}px 0`;
  };

  const slices: SlicePose[] = [];
  for (let card = 0; card < bake.count; card++) {
    const mirror = facingAt(card * pitch + pitch / 2) < 0;
    for (let s = 0; s < bake.slices; s++) {
      const theta = card * pitch + gapAngle / 2 + (s + 0.5) * sliceAngle;
      const facing = facingAt(theta);
      const front = Math.min(1, Math.max(0, 0.5 + facing * FACING_SHARPNESS));
      slices.push({
        transform: `rotateY(${round(theta / DEGREE)}deg) translateZ(${round(radius)}px) translate(${round(-sliceWidth / 2)}px,${round(-height / 2)}px)`,
        width: round(sliceWidth),
        height: round(height),
        offset: round(-(s * cardWidth) / bake.slices - (sliceWidth - cardWidth / bake.slices) / 2),
        fade: round(row.backOpacity + (1 - row.backOpacity) * front),
        shade: round(BACK_SHADE + (1 - BACK_SHADE) * front),
        blur: round(row.backBlur * (1 - front)),
        mirror,
        corners: cornersOf(s)
      });
    }
  }

  const shadowSize = radius * SHADOW_SPREAD;
  const cover = Math.max(cardWidth / bake.content.width, height / bake.content.height);
  return {
    perspective: round(row.cameraDistance),
    origin: `50% ${round(bake.height / 2 + camera.y)}px`,
    tilt: `rotateX(${round(row.tiltX)}deg) rotateZ(${round(row.tiltZ)}deg)`,
    spin: `rotateY(${round(angle)}deg)`,
    shadow: { transform: `translateY(${round(height * (0.5 + SHADOW_DROP))}px) rotateX(90deg) translate(${round(-shadowSize / 2)}px,${round(-shadowSize / 2)}px)`, size: round(shadowSize), opacity: round(row.shadowOpacity) },
    card: { width: round(cardWidth), height: round(height) },
    cover: { scale: round(cover), x: round((cardWidth - bake.content.width * cover) / 2), y: round((height - bake.content.height * cover) / 2) },
    slices
  };
}
