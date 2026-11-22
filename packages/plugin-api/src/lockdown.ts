export const LOCKED_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'Worker', 'SharedWorker', 'BroadcastChannel', 'WebTransport', 'WebSocketStream'];

export function lockdown(scope: Record<string, unknown>, names: string[] = LOCKED_GLOBALS) {
  for (const name of names) {
    if (name in scope) {
      Object.defineProperty(scope, name, { value: undefined, writable: false, configurable: false });
    }
  }
}

export const LOCKDOWN_SOURCE = `(${lockdown.toString()})(self, ${JSON.stringify(LOCKED_GLOBALS)});`;
