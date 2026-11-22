export const ACTIVE_WINDOW_DAYS = 30;

const MS_PER_DAY = 86_400_000;
const PLUGIN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type PluginTier = 'free' | 'pro';

export type PluginListing = {
  id: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latestVersion: string;
  manifest: Record<string, unknown>;
  installs: number;
  activeInstalls: number;
  upvotes: number;
  installedByMe: boolean;
  enabledByMe: boolean;
  votedByMe: boolean;
  locked: boolean;
};

export function isPluginId(value: string): boolean {
  return PLUGIN_ID.test(value);
}

export function activeSince(now: Date): Date {
  return new Date(now.getTime() - ACTIVE_WINDOW_DAYS * MS_PER_DAY);
}
