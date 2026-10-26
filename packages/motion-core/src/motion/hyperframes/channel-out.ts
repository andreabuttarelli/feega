import { px } from './html';

export type FrameSize = { width: number; height: number };

export enum Out {
  Same = 'same',
  Width = 'width',
  Height = 'height',
  Px = 'px',
  Blur = 'blur'
}

const round = (n: number) => Math.round(n * 10000) / 10000;

export const OUT: Record<Out, (value: number, frame: FrameSize) => number | string> = {
  [Out.Same]: (v) => v,
  [Out.Width]: (v, f) => round(v * f.width),
  [Out.Height]: (v, f) => round(v * f.height),
  [Out.Px]: (v) => px(v),
  [Out.Blur]: (v) => `blur(${px(v)})`
};
