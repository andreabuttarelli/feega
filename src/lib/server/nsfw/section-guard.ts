import { Capability, MODE_REFUSAL, modeAllows, type ProjectMode } from '$lib/project-mode';

const PROJECT_ROUTE = '/p/[projectId]/';

const SECTION_CAPABILITY: Readonly<Record<string, Capability>> = {
  calendar: Capability.Schedule,
  promote: Capability.Promote,
  ads: Capability.Promote,
  influencers: Capability.CatalogueWrite
};

function sectionOf(routeId: string): string | null {
  return routeId.startsWith(PROJECT_ROUTE) ? routeId.slice(PROJECT_ROUTE.length).split('/')[0] : null;
}

export function sectionRefusal(mode: ProjectMode, routeId: string): string | null {
  const capability = SECTION_CAPABILITY[sectionOf(routeId) ?? ''];
  if (!capability || modeAllows(mode, capability)) {
    return null;
  }
  return MODE_REFUSAL[capability];
}

export function guardedSection(routeId: string | null): boolean {
  return Boolean(routeId && SECTION_CAPABILITY[sectionOf(routeId) ?? '']);
}
