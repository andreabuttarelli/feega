import { error } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { forwardPut } from '$lib/server/local/cloud-account';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;

export const PUT: RequestHandler = async ({ request }) => {
  if (!localStore()) {
    error(NOT_FOUND, 'Account linking runs only in local mode');
  }
  return forwardPut('/api/v1/me/profile', request);
};
