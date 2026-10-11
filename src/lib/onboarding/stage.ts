export const STAGE = { width: 960, height: 600, safeWidth: 720 } as const;

export const PORTRAIT = { width: 360, breakpoint: 640 } as const;

export enum StageLayout {
  Landscape = 'landscape',
  Portrait = 'portrait'
}

export enum NodeFlow {
  Across = 'across',
  Down = 'down'
}

type Box = { width: number; height: number };

export function stageScale(box: Box): number {
  return Math.min(box.height / STAGE.height, box.width / STAGE.safeWidth);
}

export function stageLayout(width: number): StageLayout {
  if (width > 0 && width <= PORTRAIT.breakpoint) {
    return StageLayout.Portrait;
  }
  return StageLayout.Landscape;
}

export function portraitWorld(box: Box): { scale: number; height: number } {
  const scale = box.width / PORTRAIT.width;
  if (scale === 0) {
    return { scale: 0, height: 0 };
  }
  return { scale, height: box.height / scale };
}
