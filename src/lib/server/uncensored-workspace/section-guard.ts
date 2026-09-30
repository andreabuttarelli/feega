import { MODE_REFUSAL, SECTION_CAPABILITY, sectionAllowed, type ProjectMode } from '$lib/project-mode';

const PROJECT_ROUTE = '/p/[projectId]/';


function sectionOf(routeId: string): string | null {
  return routeId.startsWith(PROJECT_ROUTE) ? routeId.slice(PROJECT_ROUTE.length).split('/')[0] : null;
}

export function sectionRefusal(mode: ProjectMode, routeId: string): string | null {
  const section = sectionOf(routeId) ?? '';
  return sectionAllowed(mode, section) ? null : MODE_REFUSAL[SECTION_CAPABILITY[section]];
}

export function guardedSection(routeId: string | null): boolean {
  return Boolean(routeId && SECTION_CAPABILITY[sectionOf(routeId) ?? '']);
}
