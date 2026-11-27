export type PluginTier = 'free' | 'pro';

export type PluginSource = {
  id: string;
  manifestId: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latestVersion: string;
  permissions: readonly string[];
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
    permissions: ['selection', 'project', 'edit.insert']
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
      'Select an element, search the Lucide set of over 2,000 icons, pick one and set its size, stroke width and colour. Feega inserts it as a small component with the SVG inline, or, when the project already uses lucide-react, lucide-svelte or lucide-vue-next, as a component of that library. Nothing is added to package.json. One undoable step. Lucide is released under the ISC licence, Copyright Lucide Contributors (lucide.dev).'
  }
};
