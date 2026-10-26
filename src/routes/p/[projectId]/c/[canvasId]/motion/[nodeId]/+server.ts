import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { BRAND_PARAM, BRAND_REMIX_PROMPT } from '$lib/gallery/model';
import { HANDOFF_PARAM } from '$lib/canvas/chat-handoff';

const PERMANENT_REDIRECT = 308;

export const GET: RequestHandler = ({ params, url }) => {
  const path = motionEditorPath(params);
  const brand = url.searchParams.has(BRAND_PARAM) ? `&${new URLSearchParams({ [HANDOFF_PARAM]: BRAND_REMIX_PROMPT })}` : '';
  redirect(PERMANENT_REDIRECT, `${path}${brand}`);
};
