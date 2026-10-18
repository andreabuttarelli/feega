import type { Actions, RequestEvent } from '@sveltejs/kit';
import type { ProjectBrandShell } from '$lib/server/projects/brand-shell';
import type { UncensoredLock } from '$lib/uncensored-lock';

export type ProjectParams = { projectId: string };

export type ProjectShell = {
  org: { id: string; name: string; slug: string; role: string };
  project: { id: string; name: string; mode: string; brandId: string | null };
  brand: ProjectBrandShell | null;
  uncensored: { lock: UncensoredLock };
};

export type ProjectEvent = RequestEvent<ProjectParams>;

export type SettingsEvent = ProjectEvent & { parent: () => Promise<ProjectShell> };

export type SettingsActions = Actions<ProjectParams>;
