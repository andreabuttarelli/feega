import { APP_URL } from '../links';
import type { ChapterCopy, Step } from '../chapters';

export const GENERATE: ChapterCopy = {
  eyebrow: 'Prompt → Nodes → Assets',
  heading: 'Generate on the canvas',
  lead: 'Text, image, video, audio and 3D nodes, wired together. Run them yourself, from the chat or with your agents.',
  start: { href: `${APP_URL}/?utm_source=feega.app&utm_medium=site&utm_campaign=generate`, label: 'Start generating' },
  more: { href: '/ai-node-editor', label: 'Explore the node editor' }
};

export enum GenerateGlyph {
  Prompt = 'prompt',
  Wire = 'wire',
  Reuse = 'reuse'
}

export const GENERATE_STEPS: readonly Step<GenerateGlyph>[] = [
  { glyph: GenerateGlyph.Prompt, title: 'Write a prompt', text: 'Or let the chat write it.' },
  { glyph: GenerateGlyph.Wire, title: 'Wire the nodes', text: 'One result feeds the next.' },
  { glyph: GenerateGlyph.Reuse, title: 'Reuse the workflow', text: 'Run it again with new inputs.' }
];
