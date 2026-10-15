import { error, redirect, type ActionResult } from '@sveltejs/kit';

const OK = 200;
const SEE_OTHER = 303;
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const SERVER_ERROR = 500;

export const LOGIN_PATH = '/login';

export type Answer = { data?: unknown; redirect?: string; error?: string } & Record<string, unknown>;

function locationOf(status: number, body: Answer): string | null {
  if (status === UNAUTHORIZED) {
    return LOGIN_PATH;
  }
  return body.redirect ?? null;
}

export function loadedOf(status: number, body: Answer): unknown {
  const location = locationOf(status, body);
  if (location) {
    redirect(SEE_OTHER, location);
  }
  if (status >= BAD_REQUEST) {
    error(status, body.error ?? 'error');
  }
  return body.data;
}

export function actionResultOf(status: number, body: Answer): ActionResult {
  const location = locationOf(status, body);
  if (location) {
    return { type: 'redirect', status: SEE_OTHER, location };
  }
  if (status >= BAD_REQUEST) {
    return { type: 'failure', status, data: body };
  }
  return { type: 'success', status: OK, data: body.data as Record<string, unknown> | undefined };
}

export function liveActionResultOf(status: number, body: Answer): ActionResult {
  if (status < SERVER_ERROR) {
    return actionResultOf(status, body);
  }
  const message = typeof body.message === 'string' ? body.message : (body.error ?? 'error');
  return { type: 'error', status, error: { message } };
}
