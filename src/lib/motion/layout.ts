export type Box = { left: number; top: number; width: number; height: number };

export type Placement = { x: number; y: number; width: number; height: number };

export function boxOf(p: Placement, frame: { width: number; height: number }): Box {
  const width = p.width * frame.width;
  const height = p.height * frame.height;
  return { left: p.x * frame.width - width / 2, top: p.y * frame.height - height / 2, width, height };
}
