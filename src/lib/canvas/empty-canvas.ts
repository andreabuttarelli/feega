import { writable } from 'svelte/store';

export enum EmptyAction {
  Chat = 'chat',
  Frame = 'frame',
  Image = 'image',
  Video = 'video'
}

export const EMPTY_ACTIONS: readonly { action: EmptyAction; label: string }[] = [
  { action: EmptyAction.Chat, label: 'Describe what you want to make…' },
  { action: EmptyAction.Frame, label: 'Frame from a template' },
  { action: EmptyAction.Image, label: 'Generate an image' },
  { action: EmptyAction.Video, label: 'Generate a video' }
];

export function showsEmptyState(nodeCount: number, inlineMotion: string | null): boolean {
  return nodeCount === 0 && inlineMotion === null;
}

export const chatOpenRequest = writable(0);

export function requestChat(): void {
  chatOpenRequest.update((n) => n + 1);
}
