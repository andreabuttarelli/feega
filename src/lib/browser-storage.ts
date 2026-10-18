enum Kind {
  Local = 'localStorage',
  Session = 'sessionStorage'
}

function usable(kind: Kind): Storage | null {
  try {
    const store = (globalThis as Record<string, unknown>)[kind] as Storage | undefined;
    return typeof store?.getItem === 'function' ? store : null;
  } catch {
    return null;
  }
}

export const localStore = (): Storage | null => usable(Kind.Local);

export const sessionStore = (): Storage | null => usable(Kind.Session);
