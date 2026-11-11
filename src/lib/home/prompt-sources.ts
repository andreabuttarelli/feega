import { PromptKind } from '$lib/home/prompt-kinds';

export enum PromptSource {
  Github = 'github',
  Folder = 'folder',
  Upload = 'upload',
  Figma = 'figma'
}

export enum AppMode {
  Local = 'local',
  Cloud = 'cloud'
}

export enum Connect {
  Github = 'github',
  Figma = 'figma',
  None = 'none'
}

export enum OverLogin {
  Kept = 'kept',
  PickAgain = 'pick_again'
}

export type PromptSourceRow = { label: string; placeholder: string; connect: Connect; overLogin: OverLogin; modes: AppMode[] };

const EVERY_MODE = [AppMode.Local, AppMode.Cloud];

export const PROMPT_SOURCES: Record<PromptSource, PromptSourceRow> = {
  [PromptSource.Github]: { label: 'GitHub', placeholder: 'https://github.com/owner/repo', connect: Connect.Github, overLogin: OverLogin.Kept, modes: EVERY_MODE },
  [PromptSource.Folder]: { label: 'Local folder', placeholder: '/Users/you/code/my-app', connect: Connect.None, overLogin: OverLogin.PickAgain, modes: [AppMode.Local] },
  [PromptSource.Upload]: { label: 'Local folder', placeholder: '', connect: Connect.None, overLogin: OverLogin.PickAgain, modes: [AppMode.Cloud] },
  [PromptSource.Figma]: { label: 'Import from Figma', placeholder: 'https://www.figma.com/design/…', connect: Connect.Figma, overLogin: OverLogin.Kept, modes: EVERY_MODE }
};

export const PROMPT_SOURCE_ORDER = Object.values(PromptSource);

export const sourcesFor = (mode: AppMode) => PROMPT_SOURCE_ORDER.filter((source) => PROMPT_SOURCES[source].modes.includes(mode));

export function sourceOf(raw: unknown): PromptSource | null {
  return PROMPT_SOURCE_ORDER.find((source) => source === raw) ?? null;
}

export function sourceName(source: PromptSource, value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  const last = trimmed.split('/').filter(Boolean);
  return source === PromptSource.Github ? last.slice(-2).join('/') : (last.at(-1) ?? trimmed);
}

export type SourcePick = { source: PromptSource; value: string };

const FROM_SOURCE: Record<PromptKind, string> = {
  [PromptKind.Motion]: 'Make a motion video from',
  [PromptKind.Website]: 'Design a website from'
};

export function briefFor(kind: PromptKind, text: string, pick: SourcePick | null): string {
  const words = text.trim();
  if (words || !pick) {
    return words;
  }
  return `${FROM_SOURCE[kind]} ${sourceName(pick.source, pick.value)}`;
}
