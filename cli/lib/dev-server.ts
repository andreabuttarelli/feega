import { request } from './api.ts';

export type DevServerStatus = { state: string; url: string | null; source: string; folder: string; logs: string[] };

export enum DevAction {
  Status = 'status',
  Start = 'start',
  Stop = 'stop'
}

const PATH = '/api/v1/local/dev-server';

export function devServerApi(token: string, action: DevAction): Promise<DevServerStatus> {
  if (action === DevAction.Status) {
    return request<DevServerStatus>(PATH, token);
  }
  return request<DevServerStatus>(PATH, token, { method: 'POST', body: JSON.stringify({ action }) });
}
