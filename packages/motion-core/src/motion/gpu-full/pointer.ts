export type Box = { left: number; top: number; width: number; height: number };

export enum Fit {
  Fill = 'fill',
  Contain = 'contain',
  Cover = 'cover'
}

const SCALE: Record<Fit, (across: number, down: number) => number> = {
  [Fit.Fill]: () => 1,
  [Fit.Contain]: Math.min,
  [Fit.Cover]: Math.max
};

export const fitOf = (value: string | null): Fit => ((Object.values(Fit) as string[]).includes(value ?? '') ? (value as Fit) : Fit.Fill);

export function contentBox(frame: Box, aspect: number, fit: Fit): Box {
  const across = frame.width;
  const down = frame.height;
  if (fit === Fit.Fill) {
    return frame;
  }
  const scale = SCALE[fit](across / aspect, down);
  const width = scale * aspect;
  const height = scale;
  return { left: frame.left + (across - width) / 2, top: frame.top + (down - height) / 2, width, height };
}

export const unit = (box: Box, clientX: number, clientY: number): [number, number] => [(clientX - box.left) / box.width, (clientY - box.top) / box.height];
