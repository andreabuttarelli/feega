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

export type PluginShot = { readonly src: string; readonly alt: string; readonly width: number; readonly height: number };

export type PluginCopy = { description: string; icon: string; shots: readonly PluginShot[]; coverIndex: number };

const SHOT_DIR = '/img/plugins';
const SHOT_SIZE = { width: 1440, height: 900 } as const;

const shot = (name: string, alt: string): PluginShot => ({ src: `${SHOT_DIR}/${name}.webp`, alt, ...SHOT_SIZE });

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
  }
];

export const COPY: Readonly<Record<string, PluginCopy>> = {
  'mesh-gradient': {
    icon: 'mesh-gradient',
    coverIndex: 0,
    shots: [
      shot('mesh-gradient-points', 'The Feega editor with a hero section selected: a mesh gradient with four colour points over the preview, and the Mesh gradient controls with Point 1 selected in the Properties bar'),
      shot('mesh-gradient-dragging', 'The same hero after dragging a colour point: the orange and purple gradient has reshaped, and Point 2 shows its colour and softness in the Properties bar'),
      shot('mesh-gradient-randomized', 'The mesh gradient after Randomize: a green, pink and yellow gradient behind the hero heading, with the Add point, Remove point and Randomize buttons in the Properties bar')
    ],
    description:
      'Select an element and add a mesh gradient. Four colour points appear over the preview: drag them to move them, pick one to change its colour, and set how far each colour spreads. The result is plain CSS, stacked radial gradients written to the same place a manual edit would go, and Undo reverts it in one step.'
  },
  '3d-object': {
    icon: 'object-3d',
    coverIndex: 2,
    shots: [
      shot('3d-object-add-menu', 'The Add menu of the Feega editor open on 3D object, listing Cube, Sphere, Torus knot, 3D text and Model (.glb)'),
      shot('3d-object-inserted', 'A glass torus knot inserted into a section as a Scene3D layer, with Material, Lights, Auto-rotate and Colour controls in the Properties bar'),
      shot('3d-object-metal', 'The same torus knot switched to the Metal material with Studio lights and an orange colour, with auto-rotate turned off')
    ],
    description:
      'Add a cube, sphere, torus knot, 3D text or your own .glb model to the selected element. Feega writes a small scene component and the three.js code into your project, adds the dependency, and lets you change material, lights, rotation and colour from the right bar. Everything is one undoable step you can review in Changes.'
  }
};
