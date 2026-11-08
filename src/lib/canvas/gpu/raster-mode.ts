import { RasterMode } from '@feega/motion-core/motion/gpu-full/core-web';

const FLAG = 'tiles';
const ON = '1';

export const rasterMode = (search: string): RasterMode => (new URLSearchParams(search).get(FLAG) === ON ? RasterMode.Tiles : RasterMode.Retained);
