export enum ComposerKey {
  Submit = 'submit',
  Type = 'type'
}

export type ComposerKeyEvent = { key: string; shiftKey: boolean; isComposing: boolean };

export function composerKey(event: ComposerKeyEvent): ComposerKey {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return ComposerKey.Type;
  }

  return ComposerKey.Submit;
}

export function rotateTemplates<T>(all: readonly T[], turn: number, size: number): T[] {
  const shown = Math.min(size, all.length);
  return Array.from({ length: shown }, (_, i) => all[(turn + i) % all.length]);
}
