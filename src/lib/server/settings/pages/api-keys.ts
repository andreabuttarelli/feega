import type { SettingsActions } from '../event';
import { createApiKey, revokeApiKey } from '$lib/server/settings-actions';

export const actions: SettingsActions = { createApiKey, revokeApiKey };
