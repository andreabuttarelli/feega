import type { FaceBook } from './face';
import type { MotionDoc } from '../../doc';
import { fontkitEngine, fontLoader } from './load';
import { rustEngine } from './text-core-web';

export enum FaceEngine {
  Fontkit = 'fontkit',
  Rust = 'rust'
}

export const FACES_PARAM = 'faces';

const LOADERS: Record<FaceEngine, (doc: MotionDoc, assets: Record<string, string>) => Promise<FaceBook>> = {
  [FaceEngine.Fontkit]: fontLoader(undefined, fontkitEngine),
  [FaceEngine.Rust]: fontLoader(undefined, rustEngine)
};

export const faceEngineOf = (value: string | null | undefined): FaceEngine => ((Object.values(FaceEngine) as string[]).includes(value ?? '') ? (value as FaceEngine) : FaceEngine.Fontkit);

export const loadFontsWith = (engine: FaceEngine) => LOADERS[engine];
