export type RenderView = { name: string; azimuthDeg: number };

export const RENDER_VIEWS: readonly RenderView[] = [
  { name: 'front', azimuthDeg: 0 },
  { name: 'right', azimuthDeg: 90 },
  { name: 'back', azimuthDeg: 180 },
  { name: 'left', azimuthDeg: 270 }
];

const DEG_TO_RAD = Math.PI / 180;

export type CameraPosition = { x: number; y: number; z: number };

export function renderViewPositions(distance: number, height: number): CameraPosition[] {
  return RENDER_VIEWS.map(({ azimuthDeg }) => ({
    x: distance * Math.sin(azimuthDeg * DEG_TO_RAD),
    y: height,
    z: distance * Math.cos(azimuthDeg * DEG_TO_RAD)
  }));
}
