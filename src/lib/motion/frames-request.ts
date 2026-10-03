import type { MotionDoc } from './doc';

export const FRAMES_REQUEST = 'data-motion-frames';

export type FramesRequest = { callId: string; times: number[]; doc: MotionDoc };

export const CHECK_REQUEST = 'data-motion-check';

export type CheckRequest = { callId: string; name: string; doc: MotionDoc };
