import { requestRaw, type RawAnswer } from './api.ts';

export type EditStep = { op: string; target?: string; element?: string; input?: Record<string, unknown>; version?: number };

export type EditCall = EditStep & { project_id?: string; ops?: EditStep[] };

export type ViewCall = { op: string; input?: Record<string, unknown> };

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

const post = (path: string, token: string, body: unknown, org?: string): Promise<RawAnswer> => requestRaw(withOrg(path, org), token, { method: 'POST', body: JSON.stringify(body) });

export const editApi = {
  edit: (token: string, call: EditCall, org?: string) => post('/api/v1/edit', token, call, org),
  view: (token: string, call: ViewCall, org?: string) => post('/api/v1/view', token, { op: call.op, input: call.input ?? {} }, org)
};
