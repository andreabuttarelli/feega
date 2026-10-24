const FULL = 100;
const CENTRE = 50;
export const KEY_STEP = 5;

const KEY_DELTA: Record<string, number> = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP };

const clamp = (value: number) => Math.min(Math.max(value, 0), FULL);

export function sliderPercent(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) {
    return CENTRE;
  }
  return clamp(((clientX - rect.left) / rect.width) * FULL);
}

export function moveByKey(percent: number, key: string): number {
  return clamp(percent + (KEY_DELTA[key] ?? 0));
}
