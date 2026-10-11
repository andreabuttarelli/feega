export const STAGE = { width: 960, height: 600, safeWidth: 720 } as const;

export function stageScale(box: { width: number; height: number }): number {
  return Math.min(box.height / STAGE.height, box.width / STAGE.safeWidth);
}
