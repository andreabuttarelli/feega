import type { FrameRange } from '@feega/motion-core/motion/tracking/track-clip';

export enum Pass {
  Forward = 'forward',
  Backward = 'backward',
  Both = 'both'
}

export const PASS_LABEL: Record<Pass, string> = { [Pass.Forward]: 'Track forward', [Pass.Backward]: 'Track backward', [Pass.Both]: 'Track both ways' };

const RANGE: Record<Pass, (at: number, last: number) => FrameRange> = {
  [Pass.Forward]: (at, last) => ({ from: at, to: last }),
  [Pass.Backward]: (at) => ({ from: 0, to: at }),
  [Pass.Both]: (_, last) => ({ from: 0, to: last })
};

export const passRange = (pass: Pass, at: number, last: number): FrameRange => RANGE[pass](at, last);
