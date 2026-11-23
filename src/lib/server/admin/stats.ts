export type WeeklyRow = { week: string; editor: string; installs: number };
export type RetentionRaw = { cohort: string; installs: number; w1: number; w2: number; w4: number; w8: number };
export type Funnel = { installed: number; opened: number; onboarded: number; started: number; preview_ready: number; first_edit: number; signed_in: number; multi_day: number };
export type SignupRow = { week: string; total: number; confirmed: number };

export type StatsSource = {
  weekly: () => Promise<WeeklyRow[]>;
  retention: () => Promise<RetentionRaw[]>;
  funnel: () => Promise<Funnel>;
  signups: () => Promise<SignupRow[]>;
};

const PERCENT = 100;

const percent = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * PERCENT));

export async function loadStats(source: StatsSource) {
  const [weekly, retention, funnel, signups] = await Promise.all([source.weekly(), source.retention(), source.funnel(), source.signups()]);

  return {
    weekly,
    retention: retention.map((row) => ({
      cohort: row.cohort,
      installs: row.installs,
      w1: percent(row.w1, row.installs),
      w2: percent(row.w2, row.installs),
      w4: percent(row.w4, row.installs),
      w8: percent(row.w8, row.installs)
    })),
    funnel,
    signups
  };
}
