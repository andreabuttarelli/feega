export enum ImportStyle {
  Named = 'named',
  Path = 'path',
  Attribute = 'attribute'
}

export type IconLibrary = {
  pkg: string;
  style: ImportStyle;
  dirs: string[];
  component: (name: string) => string;
  nameOf: (file: string) => string;
};

const ICON_FILE = /\.(m?js|svelte)$/;

const upper = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const pascal = (name: string) => name.split(/[-_]/).map(upper).join('');
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const stem = (file: string) => file.replace(ICON_FILE, '');

const lucide = (pkg: string, style: ImportStyle, dirs: string[]): IconLibrary => ({ pkg, style, dirs, component: pascal, nameOf: stem });

export const LIBRARIES: IconLibrary[] = [
  lucide('lucide-react', ImportStyle.Named, ['dist/esm/icons']),
  lucide('lucide-vue-next', ImportStyle.Named, ['dist/esm/icons']),
  lucide('lucide-svelte', ImportStyle.Named, ['dist/icons']),
  lucide('@lucide/svelte', ImportStyle.Path, ['dist/icons']),
  { pkg: '@heroicons/react', style: ImportStyle.Named, dirs: ['24/outline'], component: (name) => `${pascal(name)}Icon`, nameOf: (file) => kebab(stem(file).replace(/Icon$/, '')) },
  { pkg: '@tabler/icons-react', style: ImportStyle.Named, dirs: ['dist/esm/icons'], component: (name) => `Icon${pascal(name)}`, nameOf: (file) => kebab(stem(file).replace(/^Icon/, '')) },
  { pkg: '@phosphor-icons/react', style: ImportStyle.Named, dirs: ['dist/csr'], component: pascal, nameOf: (file) => kebab(stem(file)) },
  { pkg: '@iconify/react', style: ImportStyle.Attribute, dirs: [], component: (name) => name, nameOf: (file) => file }
];

export function detectLibrary(manifest: string): IconLibrary | null {
  let json: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    json = JSON.parse(manifest);
  } catch {
    return null;
  }
  const have = { ...json.devDependencies, ...json.dependencies };
  return LIBRARIES.find((lib) => lib.pkg in have) ?? null;
}

export const pathName = (lib: IconLibrary, name: string) => `${lib.pkg}/icons/${name}`;
