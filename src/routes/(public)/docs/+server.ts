import { redirect } from '@sveltejs/kit';
import { movedDocsTarget } from '$lib/docs-moved';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  redirect(308, movedDocsTarget(url.pathname));
};
