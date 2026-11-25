import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { ActiveRow, AgentRow, DiffRaw, EditDimRow, ErrorRow, FeatureRow, FrameworkRow, FunnelRow, OnboardingRow, RetentionRaw, SignupRow, StatsSource, SurfaceRow, WeeklyRow } from './stats';

const STATS_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/admin/stats-db.ts'));

type Rpc = (fn: string, args?: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;

async function call<T>(fn: string, args?: Record<string, string>): Promise<T> {
  if (!STATS_USE) {
    throw new Error('admin stats service role use not declared');
  }

  const db = createServiceRoleDb(STATS_USE) as unknown as { rpc: Rpc };
  const { data, error } = await db.rpc(fn, args);
  if (error || data === null) {
    throw error ?? new Error(`${fn} returned nothing`);
  }
  return data as T;
}

export const statsDb: StatsSource = {
  weekly: () => call<WeeklyRow[]>('admin_usage_weekly_active'),
  retention: () => call<RetentionRaw[]>('admin_usage_retention'),
  signups: () => call<SignupRow[]>('admin_signups_weekly'),
  funnel: () => call<FunnelRow[]>('admin_usage_funnel_steps'),
  active: async () => {
    const [day, week] = await Promise.all([call<ActiveRow[]>('admin_usage_active', { grain: 'day' }), call<ActiveRow[]>('admin_usage_active', { grain: 'week' })]);
    return { day, week };
  },
  onboarding: () => call<OnboardingRow[]>('admin_usage_onboarding'),
  features: () => call<FeatureRow[]>('admin_usage_features'),
  agents: () => call<AgentRow[]>('admin_usage_agents'),
  errors: () => call<ErrorRow[]>('admin_usage_errors'),
  frameworks: () => call<FrameworkRow[]>('admin_usage_frameworks'),
  surfaces: () => call<SurfaceRow[]>('admin_usage_surfaces'),
  diffs: () => call<DiffRaw[]>('admin_usage_diffs'),
  editDims: () => call<EditDimRow[]>('admin_usage_edit_dims')
};
