const PATH = '/api/v1/local/dev-server';

export type DevServerView = { state: string; url: string | null; source: string; folder: string; logs: string[] };

async function read(res: Response): Promise<DevServerView> {
  if (!res.ok) {
    throw new Error((await res.json().catch(() => null))?.message ?? `dev server: ${res.status}`);
  }
  return res.json();
}

export const devServerStatus = () => fetch(PATH).then(read);

export const devServerAction = (action: 'start' | 'stop') => fetch(PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }).then(read);

export async function captureLiveSnapshot(nodeId: string): Promise<void> {
  await fetch(`${PATH}/snapshot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId }) });
}
