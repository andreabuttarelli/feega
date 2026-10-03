import type { MotionDoc } from './doc';

export const FRAMES_REQUEST = 'data-motion-frames';

export type FramesRequest = { callId: string; times: number[]; doc: MotionDoc };
