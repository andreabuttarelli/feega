export type WeeklyRow = { week: string; editor: string; installs: number };
export type RetentionRaw = { cohort: string; installs: number; w1: number; w2: number; w4: number; w8: number };
export type Funnel = { started: number; preview_ready: number; first_edit: number; multi_day: number };

export type StatsSource = {
  weekly: () => Promise<WeeklyRow[]>;
  retention: () => Promise<RetentionRaw[]>;
  funnel: () => Promise<Funnel>;
};

const PERCENT = 100;

const percent = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * PERCENT));

export async function loadStats(source: StatsSource) {
  const [weekly, retention, funnel] = await Promise.all([source.weekly(), source.retention(), source.funnel()]);

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
    funnel
  };
}
