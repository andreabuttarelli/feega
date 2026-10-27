import type { FaceBook } from './face';
import type { MotionDoc } from '../../doc';
import type { BrandTokens } from '../../brand';
import { fontkitEngine, fontLoader, webReader, type Engine } from './load';
import { rustEngine } from './text-core-web';
import { inlineCore } from '../inline-core';
import { inlineReader } from './inline-fonts';

export enum FaceEngine {
  Fontkit = 'fontkit',
  Rust = 'rust'
}

export const FACES_PARAM = 'faces';

type Loader = (doc: MotionDoc, assets: Record<string, string>, tokens: BrandTokens) => Promise<FaceBook>;

const ENGINES: Record<FaceEngine, Engine> = {
  [FaceEngine.Fontkit]: fontkitEngine,
  [FaceEngine.Rust]: rustEngine
};

const made = new Map<FaceEngine, Loader>();

function loaderOf(engine: FaceEngine): Loader {
  const fonts = inlineCore()?.fonts;
  return fontLoader(fonts ? inlineReader(fonts, webReader) : webReader, ENGINES[engine]);
}

export const faceEngineOf = (value: string | null | undefined): FaceEngine => ((Object.values(FaceEngine) as string[]).includes(value ?? '') ? (value as FaceEngine) : FaceEngine.Fontkit);

export const loadFontsWith = (engine: FaceEngine): Loader => made.get(engine) ?? made.set(engine, loaderOf(engine)).get(engine)!;
