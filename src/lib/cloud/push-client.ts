export enum PushState {
  Unsupported = 'unsupported',
  Unconfigured = 'unconfigured',
  Denied = 'denied',
  Off = 'off',
  On = 'on'
}

const SUBSCRIPTIONS_PATH = '/api/v1/push/subscriptions';
const JSON_HEADERS = { 'content-type': 'application/json' };

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function publicKey(): Promise<string | null> {
  const response = await fetch(SUBSCRIPTIONS_PATH);

  return response.ok ? ((await response.json()) as { publicKey: string | null }).publicKey : null;
}

async function current(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

export async function pushState(): Promise<PushState> {
  if (!supported()) {
    return PushState.Unsupported;
  }
  if (Notification.permission === 'denied') {
    return PushState.Denied;
  }

  return (await current()) ? PushState.On : PushState.Off;
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) {
    return PushState.Unsupported;
  }

  const key = await publicKey();
  if (!key) {
    return PushState.Unconfigured;
  }
  if ((await Notification.requestPermission()) !== 'granted') {
    return PushState.Denied;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const saved = await fetch(SUBSCRIPTIONS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(subscription.toJSON()) });

  return saved.ok ? PushState.On : PushState.Off;
}

export async function disablePush(): Promise<PushState> {
  const subscription = await current();
  if (subscription) {
    await fetch(SUBSCRIPTIONS_PATH, { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
  }

  return PushState.Off;
}
