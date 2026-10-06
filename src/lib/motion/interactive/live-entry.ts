import { LIVE_GLOBAL, installLive } from './runtime';

(window as unknown as Record<string, unknown>)[LIVE_GLOBAL] = installLive;
