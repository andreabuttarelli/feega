import { error } from '@sveltejs/kit';
import type { SettingsActions } from '../event';
import { hasManyTenants } from '$lib/server/tenancy';

// Invitare qualcuno su un brand ha senso quando i brand sono più di uno e appartengono a persone
// diverse. Con un tenant solo la pagina non è vuota: non esiste.
export const load = async () => {
  if (!hasManyTenants()) throw error(404, 'Not found');
  return {};
};

export const actions: SettingsActions = {};
