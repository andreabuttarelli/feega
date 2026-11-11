import { APP_URL } from '../links';

export enum PromptKind {
  Motion = 'motion',
  Website = 'website'
}

export enum PromptSource {
  GitHub = 'github',
  Folder = 'folder',
  Figma = 'figma'
}

export const PROMPT_KINDS: { kind: PromptKind; label: string; placeholder: string }[] = [
  { kind: PromptKind.Motion, label: 'motion video', placeholder: 'Describe a launch video, or paste your website…' },
  { kind: PromptKind.Website, label: 'website design', placeholder: 'Describe a landing page, or paste a site to redesign…' }
];

export const PROMPT_SOURCES: { source: PromptSource; label: string }[] = [
  { source: PromptSource.GitHub, label: 'GitHub' },
  { source: PromptSource.Folder, label: 'Local folder' },
  { source: PromptSource.Figma, label: 'Import from Figma' }
];

export const HANDOFF_PROMPT_MAX = 1500;

export type Handoff = { text: string; kind: PromptKind; source: PromptSource | null; images: number };

export function handoffLink(handoff: Handoff): string {
  const params = new URLSearchParams({ prompt: handoff.text.trim().slice(0, HANDOFF_PROMPT_MAX), kind: handoff.kind });
  if (handoff.source) {
    params.set('source', handoff.source);
  }
  if (handoff.images > 0) {
    params.set('attach', '1');
  }
  return `${APP_URL}/new?${params}`;
}
