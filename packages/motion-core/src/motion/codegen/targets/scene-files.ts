import { NodeKind, type CodeNode, type PageSpec } from '../ir';
import type { SceneSpec } from '../scene3d';

export type NamedScene = { name: string; spec: SceneSpec };

export const THREE_VERSION = '0.181.2';
export const THREE_TYPES_VERSION = '0.181.0';

export const scenesIn = (node: CodeNode): NamedScene[] => (node.kind === NodeKind.Element ? [...(node.scene ? [node.scene] : []), ...node.children.flatMap(scenesIn)] : []);

export const scenesOf = (page: PageSpec): NamedScene[] => [page.root, ...page.components.map((c) => c.root)].flatMap(scenesIn);

const NUMBER_LIST = /\[\n\s+(-?[\d.e+-]+(?:,\n\s+-?[\d.e+-]+)*)\n\s+\]/g;

export const dataLiteral = (spec: SceneSpec) => JSON.stringify(spec, null, 2).replace(NUMBER_LIST, (_, items: string) => `[${items.replace(/,\n\s+/g, ', ')}]`);

export const sceneConsts = (scenes: readonly NamedScene[], annotation = ''): string[] => scenes.map((s) => `export const ${s.name}${annotation} = ${dataLiteral(s.spec)};`);
