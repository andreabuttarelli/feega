import { LIVE_GLOBAL, installLive } from '@feega/motion-core/motion/interactive/runtime';

(window as unknown as Record<string, unknown>)[LIVE_GLOBAL] = installLive;
