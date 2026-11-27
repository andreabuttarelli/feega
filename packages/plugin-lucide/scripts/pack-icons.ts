import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pack } from '@feega/plugin-icon-kit/pack';

type Node = [string, Record<string, string>];

type Packed = Record<string, [string, string[]]>;

const require = createRequire(import.meta.url);
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

const read = (file: string) => JSON.parse(readFileSync(require.resolve(`lucide-static/${file}`), 'utf8'));

const markup = (nodes: Node[]) => nodes.map(([tag, attributes]) => `<${tag} ${Object.entries(attributes).map(([name, value]) => `${name}="${value}"`).join(' ')}/>`).join('');

export function packedIcons(): string {
  const nodes: Record<string, Node[]> = read('icon-nodes.json');
  const tags: Record<string, string[]> = read('tags.json');
  const icons: Packed = Object.fromEntries(Object.entries(nodes).map(([name, children]) => [name, [markup(children), tags[name] ?? []]]));

  return pack(icons);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, `export const PACKED = '${packedIcons()}';\n`);
}
