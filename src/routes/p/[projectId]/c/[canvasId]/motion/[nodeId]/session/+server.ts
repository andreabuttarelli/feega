import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadEditorSession } from '$lib/server/motion/editor-session';
import { serverTiming } from '$lib/server/server-timing';

export const GET: RequestHandler = async ({ locals, params }) => {
  const phases = serverTiming();
  const session = await loadEditorSession(locals, params, phases);
  return json(session, { headers: { 'server-timing': phases.header() } });
};
