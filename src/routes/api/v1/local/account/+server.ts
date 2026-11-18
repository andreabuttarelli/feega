import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { connect } from '$lib/server/local/cloud-account';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;

export const POST: RequestHandler = async () => {
  if (!localStore()) {
    error(NOT_FOUND, 'Account linking runs only in local mode');
  }
  return json(await connect());
};
