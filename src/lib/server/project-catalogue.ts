import type { Db } from '$lib/server/db/client';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { listedCredits } from '$lib/canvas/gen-cost';
import { catalogueIn, type ProjectMode } from '$lib/project-mode';
import { canvasModelCatalogue } from './canvas-catalogue';
import { NO_UNCENSORED_ACCESS, uncensoredAccess, visibleCatalogue } from './uncensored-access';

export async function projectCatalogue(db: Db, scope: { orgId: string; mode: ProjectMode }) {
  const [full, access] = await Promise.all([canvasModelCatalogue(), uncensoredAccess(db, scope.orgId).catch(() => NO_UNCENSORED_ACCESS)]);
  return catalogueIn(scope.mode, visibleCatalogue(full, access));
}

export type ListedModel = {
  id: string;
  label: string;
  provider: string;
  uncensored: boolean;
  credits: number | null;
  variableCredits: boolean;
  routedVia: string | null;
  inputs: string[];
  resolutions: string[];
  durations: number[];
  routes: Array<{ provider: string; label: string; credits: number | null; healthy: boolean | null }>;
};

export function listedModel(choice: ModelChoice): ListedModel {
  return {
    id: choice.id,
    label: choice.label,
    provider: choice.providerLabel,
    uncensored: choice.uncensored === true,
    credits: listedCredits(choice) ?? null,
    variableCredits: choice.variableCredits === true,
    routedVia: choice.discountRoute?.label ?? null,
    inputs: choice.inputModalities ?? [],
    resolutions: choice.resolutions ?? [],
    durations: choice.durationOptions ?? [],
    routes: (choice.routes ?? []).map((route) => ({
      provider: route.provider,
      label: route.label,
      credits: listedCredits({ ...choice, ...route.price }) ?? null,
      healthy: route.stats?.healthy ?? null
    }))
  };
}
