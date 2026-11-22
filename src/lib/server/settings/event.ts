import type { Actions, RequestEvent } from '@sveltejs/kit';

export type ProjectParams = { projectId?: string; section?: string; orgId?: string };

export type ProjectShell = {
  org: { id: string; name: string; slug: string; role: string };
  project: { id: string; name: string; mode: string };
};

export type ProjectEvent = RequestEvent<ProjectParams>;

export type SettingsEvent = ProjectEvent & { parent: () => Promise<ProjectShell> };

export type SettingsActions = Actions<ProjectParams>;

export type SharedShell = Pick<ProjectShell, 'org'> & { project: Pick<ProjectShell['project'], 'id'> | null };

export type SharedEvent = RequestEvent<Partial<ProjectParams>> & { parent: () => Promise<SharedShell> };

export type SharedActions = Record<string, (event: SharedEvent) => unknown>;
