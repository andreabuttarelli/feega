import type { VideoFrames } from '@feega/motion-core/motion/gpu-full/video-frames';
import { proxySetting } from './proxy-setting.svelte';
import { proxying } from './video-proxy';
import { createWebCodecsFrames } from './webcodecs-decoder';

let shared: VideoFrames | null = null;
let original: VideoFrames | null = null;

export const sharedFrames = (): VideoFrames => (shared ??= proxying(createWebCodecsFrames(), () => proxySetting.mode));

export const originalFrames = (): VideoFrames => (original ??= createWebCodecsFrames());
