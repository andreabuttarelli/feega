import { LOCAL_USER } from '$lib/local-user';

type Change = { table: string; eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };
type Listener = { type: string; filter: { event?: string; table?: string; filter?: string }; callback: (payload: unknown) => void };
type StatusCallback = (status: string) => void;

const EVENTS_URL = '/local/events';
const STORAGE_URL = '/local/storage';
const SUBSCRIBED = 'SUBSCRIBED';
const CHANNEL_ERROR = 'CHANNEL_ERROR';
const CLOSED = 'CLOSED';

const session = { access_token: 'local', refresh_token: 'local', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user: LOCAL_USER };

export function changeMatches(listener: Listener['filter'], change: Change): boolean {
  if (listener.table && listener.table !== change.table) {
    return false;
  }
  if (listener.event && listener.event !== '*' && listener.event !== change.eventType) {
    return false;
  }
  const [column, value] = listener.filter?.split('=eq.') ?? [];
  if (!column) {
    return true;
  }
  const row = Object.keys(change.new).length ? change.new : change.old;
  return String(row[column]) === value;
}

function channel() {
  const listeners: Listener[] = [];
  let source: EventSource | null = null;

  const joined = {
    on(type: string, filter: Listener['filter'], callback: (payload: unknown) => void) {
      listeners.push({ type, filter, callback });
      return joined;
    },
    subscribe(status?: StatusCallback) {
      source = new EventSource(EVENTS_URL);
      source.onopen = () => {
        status?.(SUBSCRIBED);
        listeners.filter((l) => l.type === 'presence').forEach((l) => l.callback({}));
      };
      source.onerror = () => status?.(CHANNEL_ERROR);
      source.onmessage = (message) => {
        const change = JSON.parse(message.data) as Change;
        listeners.filter((l) => l.type === 'postgres_changes' && changeMatches(l.filter, change)).forEach((l) => l.callback(change));
      };
      return joined;
    },
    async unsubscribe() {
      source?.close();
      source = null;
      return CLOSED;
    },
    track: async () => 'ok',
    untrack: async () => 'ok',
    send: async () => 'ok',
    presenceState: () => ({})
  };
  return joined;
}

const objectUrl = (bucket: string, path: string) => `${location.origin}${STORAGE_URL}/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

function bucket(name: string) {
  const upload = async (path: string, body: BodyInit, opts?: { contentType?: string }) => {
    const res = await fetch(objectUrl(name, path), { method: 'PUT', body, headers: { 'content-type': opts?.contentType ?? (body instanceof Blob ? body.type : '') ?? 'application/octet-stream' } });
    return res.ok ? { data: { path, id: path, fullPath: `${name}/${path}` }, error: null } : { data: null, error: { message: await res.text(), statusCode: String(res.status) } };
  };
  return {
    upload,
    update: upload,
    uploadToSignedUrl: (path: string, _token: string, body: BodyInit, opts?: { contentType?: string }) => upload(path, body, opts),
    async download(path: string) {
      const res = await fetch(objectUrl(name, path));
      return res.ok ? { data: await res.blob(), error: null } : { data: null, error: { message: `Object not found: ${path}` } };
    },
    createSignedUrl: async (path: string) => ({ data: { signedUrl: objectUrl(name, path) }, error: null }),
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: objectUrl(name, path), error: null })), error: null }),
    createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: objectUrl(name, path), path, token: 'local' }, error: null }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: objectUrl(name, path) } }),
    remove: async (paths: string[]) => ({ data: paths.map((p) => ({ name: p })), error: null })
  };
}

export function createLocalBrowserClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: LOCAL_USER }, error: null }),
      refreshSession: async () => ({ data: { session, user: LOCAL_USER }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null })
    },
    realtime: { setAuth: async () => {} },
    channel,
    removeChannel: async (joined: ReturnType<typeof channel>) => joined.unsubscribe(),
    removeAllChannels: async () => [],
    storage: { from: bucket }
  };
}
