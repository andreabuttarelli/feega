import { controlsByName } from './component-props.ts';
import { injectSource } from './inject.ts';
import { sourceId } from './source-id.ts';

type LoaderContext = { resourcePath: string; getOptions(): { root: string } };

const REGISTRY = '__feegaControls';

function registration(source: string, resourcePath: string, id: string): string {
  const controls = controlsByName(source, resourcePath);
  return controls ? `\n;globalThis.${REGISTRY} = Object.assign(globalThis.${REGISTRY} ?? {}, ${JSON.stringify({ [id]: controls })});\n` : '';
}

export default function feegaSourceLoader(this: LoaderContext, source: string): string {
  const { root } = this.getOptions();
  const id = sourceId(root, this.resourcePath);
  return (injectSource(source, id) ?? source) + registration(source, this.resourcePath, id);
}
