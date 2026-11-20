const ICON_PACKAGES = [
  'lucide-react',
  'lucide-svelte',
  '@lucide/svelte',
  'lucide-vue-next',
  'react-icons',
  '@heroicons/react',
  '@heroicons/vue',
  '@tabler/icons-',
  '@phosphor-icons/react',
  '@phosphor-icons/vue',
  'phosphor-svelte'
];

const IMPORT = /import\s+(?:type\s+)?([^;'"]*?)\s+from\s+(['"])([^'"]+)\2/g;
const DEFAULT_NAME = /^([A-Za-z_$][\w$]*)/;
const NAMED_LIST = /\{([^}]*)\}/;
const ALIAS = /^(?:type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/;
const NAMESPACE = /^\*\s+as\s+\w+/;
const WORD_START = /(^|-)(\w)/g;

type Binding = [local: string, imported: string];

const isIconPackage = (specifier: string) =>
  ICON_PACKAGES.some((pkg) => specifier.startsWith(pkg) && (pkg.endsWith('-') || specifier.length === pkg.length || specifier[pkg.length] === '/'));

function bindingsOf(clause: string): Binding[] {
  const fallback = DEFAULT_NAME.exec(clause)?.[1];
  const named = (NAMED_LIST.exec(clause)?.[1] ?? '')
    .split(',')
    .map((item) => ALIAS.exec(item.trim()))
    .flatMap((match): Binding[] => (match ? [[match[2] ?? match[1], match[1]]] : []));
  return [...(fallback ? [[fallback, fallback] as Binding] : []), ...named];
}

export function iconImports(code: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, clause, , specifier] of code.matchAll(IMPORT)) {
    if (isIconPackage(specifier)) {
      bindingsOf(clause.replace(NAMESPACE, '')).forEach(([local, imported]) => found.set(local, imported));
    }
  }
  return found;
}

export const pascalOf = (tag: string) => tag.replace(WORD_START, (_, __, char: string) => char.toUpperCase());
