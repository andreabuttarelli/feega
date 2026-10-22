import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { motionEditorPath } from '$lib/canvas/motion-node';

const PERMANENT_REDIRECT = 308;

export const GET: RequestHandler = ({ params }) => redirect(PERMANENT_REDIRECT, motionEditorPath(params));
