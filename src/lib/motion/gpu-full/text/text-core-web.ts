import type { Engine } from './load';
import { rustSource, type TextCore } from './rust-face';

const TEXT_CORE_URL = '/gpu-text/gpu_text.js';

type TextCoreModule = { default: () => Promise<unknown>; TextCore: new () => TextCore };

export const rustEngine: Engine = async () => {
  const module = (await import(/* @vite-ignore */ TEXT_CORE_URL)) as TextCoreModule;
  await module.default();
  const core = new module.TextCore();
  return (bytes) => rustSource(core, bytes);
};
