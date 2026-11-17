import { relative } from 'node:path';
import { injectSource } from './inject.ts';

type LoaderContext = { resourcePath: string; getOptions(): { root: string } };

export default function feegaSourceLoader(this: LoaderContext, source: string): string {
  const { root } = this.getOptions();
  return injectSource(source, relative(root, this.resourcePath)) ?? source;
}
