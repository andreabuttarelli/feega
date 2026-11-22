export enum EditorShotId {
  Overview = 'overview',
  Selected = 'selected',
  Changes = 'changes',
  LayersMenu = 'layers-menu',
  Responsive = 'tablet',
  React = 'react',
  Vue = 'vue',
  Nuxt = 'nuxt',
  SvelteKit = 'sveltekit'
}

export type ShotFile = { readonly src: string; readonly width: number; readonly height: number };

export type EditorShot = ShotFile & { readonly alt: string; readonly narrow: ShotFile };

const DIR = '/img/editor';
const DESKTOP = { width: 1440, height: 900 } as const;
const HALF = 2;

const file = (name: string, width: number, height: number): ShotFile => ({ src: `${DIR}/${name}.webp`, width, height });
const crop = (name: string, width: number, height: number): ShotFile => file(`crop-${name}`, width / HALF, height / HALF);
const full = (name: string): ShotFile => file(name, DESKTOP.width, DESKTOP.height);

const PROPERTIES_CROP = crop('properties', 600, 1420);

const frameworkShot = (id: EditorShotId, name: string, framework: string, source: string): EditorShot => ({
  ...full(id),
  alt: `The Feega editor on a ${framework} project: the Layers tree, a coffee shop page with its heading selected, and the Properties bar showing ${source} under the selection`,
  narrow: crop(name, 600, 440)
});

export const EDITOR_SHOTS: Readonly<Record<EditorShotId, EditorShot>> = {
  [EditorShotId.Overview]: {
    ...full(EditorShotId.Overview),
    alt: 'The Feega editor: the Layers tree on the left, a running coffee shop page in the middle with a button selected, and the Properties bar on the right',
    narrow: PROPERTIES_CROP
  },
  [EditorShotId.Selected]: {
    ...full(EditorShotId.Selected),
    alt: 'The Feega editor with the page heading selected: size, spacing, typography, fill and radius rows in the Properties bar, and the source file and line under the selection',
    narrow: PROPERTIES_CROP
  },
  [EditorShotId.Changes]: {
    ...full(EditorShotId.Changes),
    alt: 'The Changes tab of the Feega editor after one edit: one file changed, a border-radius of 999px with Show diff and Revert buttons',
    narrow: crop('changes', 600, 330)
  },
  [EditorShotId.LayersMenu]: {
    ...full(EditorShotId.LayersMenu),
    alt: 'The Feega editor with a right-click menu open on a layer, offering Copy for agent, Duplicate, Add as child, Wrap with, Unwrap and Delete',
    narrow: crop('layers-menu', 720, 430)
  },
  [EditorShotId.Responsive]: {
    ...full(EditorShotId.Responsive),
    alt: 'The Feega editor with the preview set to a 768 pixel tablet width: the page reflows beside the Layers tree and the Properties bar',
    narrow: crop('responsive', 1289, 1450)
  },
  [EditorShotId.React]: frameworkShot(EditorShotId.React, 'react', 'React', 'App.jsx'),
  [EditorShotId.Vue]: frameworkShot(EditorShotId.Vue, 'vue', 'Vue', 'App.vue'),
  [EditorShotId.Nuxt]: frameworkShot(EditorShotId.Nuxt, 'nuxt', 'Nuxt 4', 'app.vue'),
  [EditorShotId.SvelteKit]: frameworkShot(EditorShotId.SvelteKit, 'sveltekit', 'SvelteKit', '+page.svelte')
};

export const NARROW_MEDIA = '(max-width: 640px)';
