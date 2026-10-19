import { error, redirect, type ActionResult } from '@sveltejs/kit';

const OK = 200;
const SEE_OTHER = 303;
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const SERVER_ERROR = 500;
const LOGIN_PATH = '/login';

type Body = Record<string, unknown>;

function locationOf(status: number, body: Body): string | null {
  if (status === UNAUTHORIZED) {
    return LOGIN_PATH;
  }
  return typeof body.redirect === 'string' ? body.redirect : null;
}

export function pageActionOf(status: number, body: Body): ActionResult {
  const location = locationOf(status, body);
  if (location) {
    return { type: 'redirect', status: SEE_OTHER, location };
  }
  if (status >= SERVER_ERROR) {
    return { type: 'error', status, error: { message: String(body.error ?? body.message ?? 'error') } };
  }
  if (status >= BAD_REQUEST) {
    return { type: 'failure', status, data: body };
  }
  return { type: 'success', status: OK, data: body };
}

export function pageLoadOf(status: number, body: Body): Body {
  const location = locationOf(status, body);
  if (location) {
    redirect(SEE_OTHER, location);
  }
  if (status >= BAD_REQUEST) {
    error(status, String(body.error ?? body.message ?? 'error'));
  }
  return body;
}
