import type { Attachment } from 'svelte/attachments';

export enum Closes {
  Here = 'here',
  ItsOwner = 'its-owner'
}

type Layer = { close: () => void; closes: Closes; trigger: HTMLElement | null };

const layers: Layer[] = [];

function onEscape(e: KeyboardEvent) {
  const top = layers.at(-1);
  if (e.key !== 'Escape' || !top || top.closes === Closes.ItsOwner) {
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  top.close();
  if (top.trigger?.isConnected) {
    top.trigger.focus();
  }
}

const focused = (): HTMLElement | null => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);

export function openLayer(close: () => void, closes: Closes = Closes.Here): () => void {
  const layer = { close, closes, trigger: focused() };
  if (!layers.length) {
    window.addEventListener('keydown', onEscape, true);
  }
  layers.push(layer);

  return () => {
    layers.splice(layers.indexOf(layer), 1);
    if (!layers.length) {
      window.removeEventListener('keydown', onEscape, true);
    }
  };
}

export const dismissible =
  (close: () => void): Attachment<HTMLElement> =>
  () =>
    openLayer(close);
