import { error } from '@sveltejs/kit';
import type { SettingsActions } from '../event';
import { hasManyTenants } from '$lib/server/tenancy';

export const load = async () => {
  if (!hasManyTenants()) throw error(404, 'Not found');
  return {};
};

export const actions: SettingsActions = {};
