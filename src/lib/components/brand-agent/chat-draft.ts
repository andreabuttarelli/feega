import { sessionStore } from '$lib/browser-storage';
const PREFIX = 'feega:chat-draft:';

export function keptDraft(endpoint: string, store: Storage | null = sessionStore()): string {
  try {
    return store?.getItem(PREFIX + endpoint) ?? '';
  } catch {
    return '';
  }
}

export function keepDraft(endpoint: string, text: string, store: Storage | null = sessionStore()) {
  try {
    if (text) {
      store?.setItem(PREFIX + endpoint, text);
      return;
    }
    store?.removeItem(PREFIX + endpoint);
  } catch {
    return;
  }
}
