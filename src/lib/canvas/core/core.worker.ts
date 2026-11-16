import { serveCore } from '@feega/motion-core/motion/gpu-full/core-worker';

serveCore(self as unknown as Parameters<typeof serveCore>[0]);
