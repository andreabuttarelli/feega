export enum Fit {
  Cover = 'cover',
  Contain = 'contain'
}

export const FIT_SCALE: Record<Fit, 'max' | 'min'> = { [Fit.Cover]: 'max', [Fit.Contain]: 'min' };

export type Size = { width: number; height: number };
export type Box = Size & { left: number; top: number };

export function fitBox(frame: Size, content: Size, pick: (a: number, b: number) => number): Box {
  const scale = pick(frame.width / content.width, frame.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return { left: (frame.width - width) / 2, top: (frame.height - height) / 2, width, height };
}
