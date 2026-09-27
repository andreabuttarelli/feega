export const WIZARD_STEPS = ['website', 'analysis', 'products', 'target', 'handles', 'overview'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

const RETIRED_STEPS: Record<string, WizardStep> = {
  competitors: 'handles'
};

const RETIRED_DRAFT_FIELDS = ['competitorHandles'] as const;

function stepFrom(raw: unknown): WizardStep | null {
  if (typeof raw !== 'string') {
    return null;
  }
  if ((WIZARD_STEPS as readonly string[]).includes(raw)) {
    return raw as WizardStep;
  }
  return RETIRED_STEPS[raw] ?? null;
}

export function restoreWizardState<D extends object>(saved: unknown, empty: D): { step: WizardStep; draft: D } {
  const fresh = { step: WIZARD_STEPS[0], draft: empty };
  if (!saved || typeof saved !== 'object') {
    return fresh;
  }

  const { step, draft } = saved as { step?: unknown; draft?: unknown };
  const restoredStep = stepFrom(step);
  if (!restoredStep) {
    return fresh;
  }

  const kept = { ...empty, ...(draft && typeof draft === 'object' ? draft : {}) } as Record<string, unknown>;
  for (const field of RETIRED_DRAFT_FIELDS) {
    delete kept[field];
  }

  return { step: restoredStep, draft: kept as D };
}
