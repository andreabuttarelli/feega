import { injectSource } from './inject.ts';
import { sourceId } from './source-id.ts';

type LoaderContext = { resourcePath: string; getOptions(): { root: string } };

export default function feegaSourceLoader(this: LoaderContext, source: string): string {
  const { root } = this.getOptions();
  return injectSource(source, sourceId(root, this.resourcePath)) ?? source;
}
