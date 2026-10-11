export enum StudioRole {
  Builder = 'builder',
  Critic = 'critic'
}

export type RoleSpec = { label: string; budgetShare: number };

export const STUDIO_ROSTER: Record<StudioRole, RoleSpec> = {
  [StudioRole.Builder]: { label: 'motion-agent', budgetShare: 0.88 },
  [StudioRole.Critic]: { label: 'motion-critic', budgetShare: 0.12 }
};

export const roleBudgetUsd = (role: StudioRole, capUsd: number) => capUsd * STUDIO_ROSTER[role].budgetShare;
