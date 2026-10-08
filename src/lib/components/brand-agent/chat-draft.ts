const PREFIX = 'feega:chat-draft:';

function tabStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function keptDraft(endpoint: string, store: Storage | null = tabStorage()): string {
  try {
    return store?.getItem(PREFIX + endpoint) ?? '';
  } catch {
    return '';
  }
}

export function keepDraft(endpoint: string, text: string, store: Storage | null = tabStorage()) {
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
