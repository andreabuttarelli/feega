import { request } from './api.ts';

export type CanvasCall = { project: string; op: string; input?: Record<string, unknown> };

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

export const canvasApi = {
  run: <T = unknown>(token: string, call: CanvasCall, org?: string) =>
    request<T>(withOrg('/api/v1/org/canvas', org), token, {
      method: 'POST',
      body: JSON.stringify({ project_id: call.project, op: call.op, input: call.input ?? {} })
    })
};
