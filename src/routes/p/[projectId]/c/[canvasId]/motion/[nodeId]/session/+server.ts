import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadEditorSession } from '$lib/server/motion/editor-session';

export const GET: RequestHandler = async ({ locals, params, url }) => json(await loadEditorSession(locals, params, url));
