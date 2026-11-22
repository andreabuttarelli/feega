import type { Shot } from '../alternative';
import { IMG } from './sources';

export const CLAUDE_HERO: Shot = {
  src: `${IMG}/feega-claude-code.webp`,
  alt: 'Feega open in VS Code beside a Claude Code panel: layers on the left, a running storefront page in the middle, the Properties bar and the agent’s one line diff on the right',
  width: 1600,
  height: 972,
  caption: 'Feega next to Claude Code in VS Code. The picked element, its Properties and the agent’s diff are on one screen.'
};

export const CLAUDE_DIFF: Shot = {
  src: `${IMG}/crop-agent-diff.webp`,
  alt: 'Close crop of a Claude Code reply with a diff in Hero.svelte where the class cta is replaced by site-pill',
  width: 742,
  height: 280,
  caption: 'Zoomed in on the agent’s side: one file changed, one line added and one removed.'
};

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

export const CODEX_HERO: Shot = {
  src: `${IMG}/feega-codex.webp`,
  alt: 'Illustrative composite: the real Feega editor on the left and a generic agent side panel on the right with a short prompt, a file list and a one line diff',
  width: 1600,
  height: 982,
  caption: 'Illustrative: the real Feega editor beside a generic agent panel. It is not the interface of any product.'
};

export const CURSOR_HERO: Shot = {
  src: `${IMG}/feega-cursor.webp`,
  alt: 'Illustrative composite: the real Feega editor on the left and a generic agent side panel on the right showing a spacing prompt and a one line diff',
  width: 1600,
  height: 982,
  caption: 'Illustrative: the real Feega editor beside a generic agent panel. It is not the interface of any product.'
};
