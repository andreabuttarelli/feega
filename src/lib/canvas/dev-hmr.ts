const HMR_PROTOCOL = 'vite-hmr';
const VITE_CLIENT_PATH = '/@vite/client';
const WS_TOKEN = /wsToken\s*=\s*"([^"]+)"/;
const PAGE_CHANGES = new Set(['update', 'full-reload']);

export function hmrSocketUrl(origin: string, clientSource: string): string {
  const base = `${origin.replace(/\/+$/, '').replace(/^http/, 'ws')}/`;
  const token = WS_TOKEN.exec(clientSource)?.[1];
  return token ? `${base}?token=${token}` : base;
}

export function changesPage(message: string): boolean {
  try {
    return PAGE_CHANGES.has(JSON.parse(message)?.type);
  } catch {
    return false;
  }
}

export function watchHmr(origin: string, onchange: () => void): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;

  void fetch(`${origin.replace(/\/+$/, '')}${VITE_CLIENT_PATH}`)
    .then((res) => (res.ok ? res.text() : ''))
    .then((source) => {
      if (stopped) {
        return;
      }
      socket = new WebSocket(hmrSocketUrl(origin, source), HMR_PROTOCOL);
      socket.onmessage = (e) => {
        if (changesPage(String(e.data))) {
          onchange();
        }
      };
    })
    .catch(() => {});

  return () => {
    stopped = true;
    socket?.close();
  };
}
