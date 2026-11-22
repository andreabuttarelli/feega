import type { Shot } from '../alternative';
import { IMG } from './sources';

export const PROPERTIES_CROP: Shot = {
  src: `${IMG}/crop-properties.webp`,
  alt: 'Close crop of the Feega Properties bar for a selected link, with size, spacing, typography, fill and radius rows',
  width: 485,
  height: 1339,
  caption: 'The Properties bar for a selected element. Each row writes to the line shown above it.'
};

export const EDITOR_PROPERTIES: Shot = {
  src: `${IMG}/feega-editor-properties.webp`,
  alt: 'The Feega editor with the Layers tree on the left, a running page in the middle and the Properties bar with a selected link on the right',
  width: 1200,
  height: 760,
  caption: 'The editor on a running page: Layers, the page itself and Properties, with the source file and line under the selection.'
};

export const OVERVIEW_SHOT: Shot = {
  src: '/img/editor/overview.webp',
  alt: 'The Feega editor: the Layers tree on the left, a release monitoring landing page in the middle with its hero button selected, and the Properties bar on the right',
  width: 1440,
  height: 900,
  caption: 'The Feega editor on a running page: Layers, the page itself and Properties.'
};

export const SELECTED_SHOT: Shot = {
  src: '/img/editor/selected.webp',
  alt: 'The Feega editor on a photographer portfolio with the page heading selected: size, spacing, typography, fill and radius rows in the Properties bar, and the source file and line under the selection',
  width: 1440,
  height: 900,
  caption: 'A selected element with its Properties and the source line under it.'
};

export const CHANGES_SHOT: Shot = {
  src: '/img/editor/changes.webp',
  alt: 'The Changes tab of the Feega editor on a home goods shop after one edit: one file changed, a border-radius of 12px with Show diff and Revert buttons',
  width: 1440,
  height: 900,
  caption: 'The Changes tab after one edit: the file touched, with Show diff and Revert.'
};
