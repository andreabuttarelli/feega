export type PluginTier = 'free' | 'pro';

export type PluginCredit = { name: string; url: string; license: string };

export const creditLine = (credit: PluginCredit | undefined): string => (credit ? `Built on ${credit.name} · ${credit.license}` : '');

export enum PluginLabel {
  ByFeega = 'By Feega',
  Community = 'Community',
  Unofficial = 'Unofficial'
}

export const labelsOf = (source: PluginSource | undefined): PluginLabel[] => {
  if (!source) {
    return [PluginLabel.Community];
  }

  return source.credit ? [PluginLabel.Community, PluginLabel.Unofficial] : [PluginLabel.ByFeega];
};

export type PluginSource = {
  id: string;
  manifestId: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latestVersion: string;
  permissions: readonly string[];
  credit?: PluginCredit;
};

export type PluginCopy = { description: string; icon: string };

export const SOURCES: readonly PluginSource[] = [
  {
    id: 'mesh-gradient',
    manifestId: 'feega.mesh-gradient',
    name: 'Mesh gradient',
    summary: 'Drag colour points over an element and get a plain CSS mesh gradient.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'edit.style']
  },
  {
    id: '3d-object',
    manifestId: 'feega.object-3d',
    name: '3D object',
    summary: 'Add a cube, sphere, torus knot, 3D text or a .glb model and edit its material and lights.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'project', 'edit.insert', 'edit.attributes', 'edit.dependency', 'edit.asset', 'file.pick']
  },
  {
    id: 'lucide-icons',
    manifestId: 'feega.lucide-icons',
    name: 'Lucide icons',
    summary: 'Search the Lucide icon set and insert an icon with the size, stroke and colour you want.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'project', 'edit.insert', 'network:cdn.jsdelivr.net', 'network:unpkg.com'],
    credit: { name: 'Lucide', url: 'https://lucide.dev', license: 'ISC' }
  },
  {
    id: 'brand-logos',
    manifestId: 'feega.brand-logos',
    name: 'Brand logos',
    summary: 'Search over 3,000 brand logos and insert one as inline SVG in its brand colour or yours.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'project', 'edit.insert', 'network:cdn.jsdelivr.net', 'network:unpkg.com'],
    credit: { name: 'Simple Icons', url: 'https://simpleicons.org', license: 'CC0' }
  },
  {
    id: 'gradient-presets',
    manifestId: 'feega.gradient-presets',
    name: 'Gradient presets',
    summary: 'Pick a subtle linear, radial or conic gradient from a curated gallery and apply it as a background.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'edit.style']
  },
  {
    id: 'phosphor-icons',
    manifestId: 'feega.phosphor-icons',
    name: 'Phosphor icons',
    summary: 'Search the Phosphor icon set in six weights and insert an icon with the size and colour you want.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'project', 'edit.insert', 'network:cdn.jsdelivr.net', 'network:unpkg.com'],
    credit: { name: 'Phosphor Icons', url: 'https://phosphoricons.com', license: 'MIT' }
  },
  {
    id: 'heroicons',
    manifestId: 'feega.heroicons',
    name: 'Heroicons',
    summary: 'Search Heroicons in outline, solid, mini and micro styles and insert one with your size and colour.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'project', 'edit.insert', 'network:cdn.jsdelivr.net', 'network:unpkg.com'],
    credit: { name: 'Heroicons', url: 'https://heroicons.com', license: 'MIT' }
  },
  {
    id: 'shadergradient',
    manifestId: 'feega.shadergradient',
    name: 'ShaderGradient',
    summary: 'Insert a ShaderGradient background and edit its type, colours, grain and motion props.',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    permissions: ['selection', 'source', 'project', 'edit.attributes', 'edit.insert', 'edit.dependency'],
    credit: { name: 'ShaderGradient', url: 'https://shadergradient.co', license: 'MIT' }
  }
];

export const COPY: Readonly<Record<string, PluginCopy>> = {
  'mesh-gradient': {
    icon: 'mesh-gradient',
    description:
      'Select an element and add a mesh gradient. Four colour points appear over the preview: drag them to move them, pick one to change its colour, and set how far each colour spreads. The result is plain CSS, stacked radial gradients written to the same place a manual edit would go, and Undo reverts it in one step.'
  },
  '3d-object': {
    icon: 'object-3d',
    description:
      'Add a cube, sphere, torus knot, 3D text or your own .glb model to the selected element. Feega writes a small scene component and the three.js code into your project, adds the dependency, and lets you change material, lights, rotation and colour from the right bar. Everything is one undoable step you can review in Changes.'
  },
  'lucide-icons': {
    icon: 'lucide',
    description:
      'Select an element, search the Lucide set of over 2,000 icons, pick one and set its size, stroke width and colour. Feega inserts it as a small component with the SVG inline, or, when the project already uses lucide-react, lucide-svelte or lucide-vue-next, as a component of that library. Nothing is added to package.json. Icons are downloaded from jsDelivr (unpkg as fallback) the first time they are shown, so the first use needs internet. One undoable step. Lucide is released under the ISC licence, Copyright Lucide Contributors (lucide.dev).'
  },
  'brand-logos': {
    icon: 'brand-logos',
    description:
      'Select an element, search over 3,000 brand logos, pick one and set its size and whether it keeps the official brand colour or follows the text colour. Feega inserts it as a small component with the SVG inline and an accessible title. Nothing is added to package.json. Logos are downloaded from jsDelivr (unpkg as fallback) the first time they are shown, so the first use needs internet. One undoable step. Logo shapes come from Simple Icons (CC0). The logos are trademarks of their owners: brand guidelines apply to how you use them.'
  },
  'gradient-presets': {
    icon: 'gradient-presets',
    description:
      'Select an element and click a gradient from a gallery of 36 subtle, modern presets: linear, radial and conic. It is applied as the element background image, written as plain CSS in the same place a manual style edit goes. One undoable step. Remove gradient resets the background image.'
  },
  'phosphor-icons': {
    icon: 'phosphor',
    description:
      'Select an element, search the Phosphor set of over 1,500 icons by name or tag, choose a weight (thin, light, regular, bold, fill or duotone), size and colour, and insert it. Feega writes a small component with the SVG inline, or, when the project already uses @phosphor-icons/react or @phosphor-icons/vue, a component of that library with the weight as a prop. Nothing is added to package.json. Icons are downloaded from jsDelivr (unpkg as fallback) the first time they are shown, so the first use needs internet. One undoable step. Phosphor Icons are released under the MIT licence, Copyright Phosphor Icons.'
  },
  heroicons: {
    icon: 'heroicons',
    description:
      'Select an element, search the 324 Heroicons, choose a style (outline, solid, mini or micro), size and colour, and insert it. Feega writes a small component with the SVG inline, or, when the project already uses @heroicons/react or @heroicons/vue, a component of that library, sized with width and height. Nothing is added to package.json. Icons are downloaded from jsDelivr (unpkg as fallback) the first time they are shown, so the first use needs internet. One undoable step. Heroicons are released under the MIT licence, Copyright Tailwind Labs, Inc.'
  },
  shadergradient: {
    icon: 'shadergradient',
    description:
      'Select an element and add a ShaderGradient background, or select one that already holds a ShaderGradient and edit its type, colours, animation, grain, light and camera from the right bar. Feega adds the @shadergradient/react, @react-three/fiber and three packages to package.json when they are missing and writes a small component into your project. One undoable step you can review in Changes. ShaderGradient is released under the MIT licence. This plugin is a community plugin, not made or endorsed by ShaderGradient.'
  }
};
