export type WeeklyRow = { week: string; editor: string; installs: number };
export type RetentionRaw = { cohort: string; installs: number; w1: number; w2: number; w4: number; w8: number };
export type FunnelRow = { step: string; installs: number };
export type SignupRow = { week: string; total: number; confirmed: number; blocked?: number };
export type ActiveRow = { period: string; installs: number; signed_in: number; anonymous: number };
export type Active = { day: ActiveRow[]; week: ActiveRow[] };
export type OnboardingRow = { step: string; viewed: number; completed: number; skipped: number };
export type FeatureRow = { event: string; events: number; installs: number };
export type AgentRow = { agent: string; sessions: number; messages: number; tool_calls: number; allowed: number; rejected: number; cancels: number; errors: number; diffs: number; reverted: number };
export type ErrorRow = { event: string; error_class: string; area: string; events: number; installs: number };
export type FrameworkRow = { framework: string; styling: string; installs: number };
export type SurfaceRow = { editor: string; os: string; ext_version: string; installs: number };
export type DiffRaw = { day: string; diffs: number; manual: number; ai: number; reverted: number; lines_added: number; lines_removed: number };
export type EditDimRow = { dim: string; value: string; diffs: number };

export type StatsSource = {
  weekly: () => Promise<WeeklyRow[]>;
  retention: () => Promise<RetentionRaw[]>;
  signups: () => Promise<SignupRow[]>;
  funnel: () => Promise<FunnelRow[]>;
  active: () => Promise<Active>;
  onboarding: () => Promise<OnboardingRow[]>;
  features: () => Promise<FeatureRow[]>;
  agents: () => Promise<AgentRow[]>;
  errors: () => Promise<ErrorRow[]>;
  frameworks: () => Promise<FrameworkRow[]>;
  surfaces: () => Promise<SurfaceRow[]>;
  diffs: () => Promise<DiffRaw[]>;
  editDims: () => Promise<EditDimRow[]>;
};

const PERCENT = 100;
const EDIT_DIMS = ['prop_category', 'target', 'file_ext', 'breakpoint', 'state'] as const;

const percent = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * PERCENT));

async function block<T>(name: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`admin stats: ${name} failed`, error);
    return null;
  }
}

function rankedDims(rows: EditDimRow[]) {
  return Object.fromEntries(
    EDIT_DIMS.map((dim) => [
      dim,
      rows
        .filter((row) => row.dim === dim)
        .map(({ value, diffs }) => ({ value, diffs }))
        .sort((a, b) => b.diffs - a.diffs)
    ])
  ) as Record<(typeof EDIT_DIMS)[number], { value: string; diffs: number }[]>;
}

export async function loadStats(source: StatsSource) {
  const [weekly, retention, signups, funnel, active, onboarding, features, agents, errors, frameworks, surfaces, diffs, editDims] = await Promise.all([
    block('weekly', source.weekly),
    block('retention', source.retention),
    block('signups', source.signups),
    block('funnel', source.funnel),
    block('active', source.active),
    block('onboarding', source.onboarding),
    block('features', source.features),
    block('agents', source.agents),
    block('errors', source.errors),
    block('frameworks', source.frameworks),
    block('surfaces', source.surfaces),
    block('diffs', source.diffs),
    block('editDims', source.editDims)
  ]);

  return {
    weekly,
    retention:
      retention?.map((row) => ({
        cohort: row.cohort,
        installs: row.installs,
        w1: percent(row.w1, row.installs),
        w2: percent(row.w2, row.installs),
        w4: percent(row.w4, row.installs),
        w8: percent(row.w8, row.installs)
      })) ?? null,
    signups,
    funnel: funnel?.map((row) => ({ ...row, percent: percent(row.installs, funnel[0].installs) })) ?? null,
    active,
    onboarding,
    features,
    agents,
    errors,
    frameworks,
    surfaces,
    diffs: diffs?.map((row) => ({ ...row, revertRate: percent(row.reverted, row.diffs), aiShare: percent(row.ai, row.diffs) })) ?? null,
    editDims: editDims ? rankedDims(editDims) : null
  };
}
