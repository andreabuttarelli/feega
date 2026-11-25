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

export type EditorShot = ShotFile & { readonly alt: string };

const DIR = '/img/editor';
const DESKTOP = { width: 1440, height: 900 } as const;

const file = (name: string, width: number, height: number): ShotFile => ({ src: `${DIR}/${name}.webp`, width, height });
const full = (name: string): ShotFile => file(name, DESKTOP.width, DESKTOP.height);

const frameworkShot = (id: EditorShotId, framework: string, page: string, source: string): EditorShot => ({
  ...full(id),
  alt: `The Feega editor on a ${framework} project: the Layers tree, ${page} with its heading selected, and the Properties bar showing ${source} under the selection`
});

export const EDITOR_SHOTS: Readonly<Record<EditorShotId, EditorShot>> = {
  [EditorShotId.Overview]: {
    ...full(EditorShotId.Overview),
    alt: 'The Feega editor: the Layers tree on the left, a release monitoring landing page in the middle with its hero button selected, and the Properties bar on the right'
  },
  [EditorShotId.Selected]: {
    ...full(EditorShotId.Selected),
    alt: 'The Feega editor on a photographer portfolio with the page heading selected: size, spacing, typography, fill and radius rows in the Properties bar, and the source file and line under the selection'
  },
  [EditorShotId.Changes]: {
    ...full(EditorShotId.Changes),
    alt: 'The Changes tab of the Feega editor on a home goods shop after one edit: one file changed, a border-radius of 12px with Show diff and Revert buttons'
  },
  [EditorShotId.LayersMenu]: {
    ...full(EditorShotId.LayersMenu),
    alt: 'The Feega editor on an analytics dashboard with a right-click menu open on a layer, offering Copy for agent, Duplicate, Add as child, Wrap with, Unwrap and Delete'
  },
  [EditorShotId.Responsive]: {
    ...full(EditorShotId.Responsive),
    alt: 'The Feega editor with a blog home previewed at a 768 pixel tablet width: the page reflows beside the Layers tree and the Properties bar'
  },
  [EditorShotId.React]: frameworkShot(EditorShotId.React, 'React', 'a creative agency page', 'HeroBento.tsx'),
  [EditorShotId.Vue]: frameworkShot(EditorShotId.Vue, 'Vue', 'a documentation site', 'Steps.vue'),
  [EditorShotId.Nuxt]: frameworkShot(EditorShotId.Nuxt, 'Nuxt 4', 'a coffee roaster page', 'FeatureImage.vue'),
  [EditorShotId.SvelteKit]: frameworkShot(EditorShotId.SvelteKit, 'SvelteKit', 'a conference page', 'HeroMedia.svelte')
};
