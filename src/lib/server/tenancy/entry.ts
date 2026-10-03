import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile } from '$lib/server/repos/profiles';
import { listMemberships } from '$lib/server/repos/orgs';
import { createProject, listProjects } from '$lib/server/repos/projects';
import { ProjectMode } from '$lib/project-mode';
import { createCanvas, listCanvases } from '$lib/server/repos/canvas';
import { createFirstOrg } from '$lib/server/tenancy/bootstrap';
import { chooseOrg } from '$lib/server/tenancy/context';
import { seedWelcome } from '$lib/server/onboarding/welcome';
import { WELCOME_PARAM, type Campaign } from '$lib/onboarding/campaigns';

/**
 * ENTRARE NELL'APP È UN BOOTSTRAP SILENZIOSO, NON UN MODULO DA COMPILARE.
 *
 *   profilo ──> org ──> progetto ──> tela ──> si apre la tela
 *
 * Ogni gradino è IDEMPOTENTE: cerca, e crea solo se non trova. Una seconda visita percorre la
 * stessa scala senza costruirne una nuova, e chi ha già tutto entra al primo colpo. L'ordine non
 * è estetico — `orgs_members.user_id` referenzia `profiles`, e la tela referenzia il progetto:
 * saltare un gradino è una violazione di chiave esterna, non un difetto di stile.
 *
 * Le dipendenze arrivano come argomento perché è ciò che rende provabile «non crea due volte»
 * senza un database: la domanda è quante volte si chiama la creazione, non cosa torna.
 */
export const DEFAULT_PROJECT_NAME = 'Untitled';
export const DEFAULT_CANVAS_NAME = 'Untitled';
const DEFAULT_WORKSPACE_NAME = 'My workspace';
const DEFAULT_PROJECT_SLUG = 'untitled';

export type Entry = { orgId: string; projectId: string; canvasId: string; firstRun: boolean };

export const DASHBOARD_PATH = '/app';

export enum EntryVia {
  Direct = 'direct',
  Invite = 'invite'
}

export enum Arrival {
  Returning = 'returning',
  FirstRun = 'first_run',
  Campaign = 'campaign',
  Invite = 'invite'
}

export enum Landing {
  Dashboard = 'dashboard',
  Canvas = 'canvas'
}

export const ARRIVAL_LANDING: Record<Arrival, Landing> = {
  [Arrival.Returning]: Landing.Dashboard,
  [Arrival.FirstRun]: Landing.Canvas,
  [Arrival.Campaign]: Landing.Canvas,
  [Arrival.Invite]: Landing.Canvas
};

export function arrivalOf(input: { campaign: boolean; via: EntryVia; firstRun: boolean }): Arrival {
  if (input.campaign) {
    return Arrival.Campaign;
  }
  if (input.via === EntryVia.Invite) {
    return Arrival.Invite;
  }
  return input.firstRun ? Arrival.FirstRun : Arrival.Returning;
}

export type EntryDeps = {
  ensureProfile: typeof ensureProfile;
  listMemberships: typeof listMemberships;
  createFirstOrg: typeof createFirstOrg;
  listProjects: typeof listProjects;
  createProject: typeof createProject;
  listCanvases: typeof listCanvases;
  createCanvas: typeof createCanvas;
  seedWelcome: typeof seedWelcome;
};

export const ENTRY_DEPS: EntryDeps = {
  ensureProfile,
  listMemberships,
  createFirstOrg,
  listProjects,
  createProject,
  listCanvases,
  createCanvas,
  seedWelcome
};

/** Il canvas vive DENTRO il progetto: `/p/<projectId>/c/<canvasId>`, come le altre pagine del progetto. */
export function canvasPath(projectId: string, canvasId: string): string {
  return `/p/${projectId}/c/${canvasId}`;
}

export function workspaceNameFor(user: User): string {
  return user.email?.split('@')[0] || DEFAULT_WORKSPACE_NAME;
}

type FirstOrgResult = Awaited<ReturnType<EntryDeps['createFirstOrg']>>;

/**
 * DUE SCHEDE AL PRIMO ACCESSO, UNA SOLA ORG.
 *
 * `listMemberships` risponde vuoto a entrambe e la creazione partirebbe due volte. La promessa
 * è una sola per utente: chi arriva mentre la prima è in corso la riusa, invece di aprirne un'altra.
 */
const firstOrgFlights = new Map<string, Promise<FirstOrgResult>>();

function firstOrgOnce(
  create: EntryDeps['createFirstOrg'],
  input: { userId: string; name: string }
): Promise<FirstOrgResult> {
  const pending = firstOrgFlights.get(input.userId);
  if (pending) {
    return pending;
  }

  const flight = create(input).finally(() => firstOrgFlights.delete(input.userId));
  firstOrgFlights.set(input.userId, flight);
  return flight;
}

/**
 * STESSA CORSA, STESSO RIMEDIO: DUE SCHEDE SULLA STESSA ORG VUOTA NON CREANO DUE "UNTITLED".
 *
 * `listProjects` seguito da un `insert` non è atomico: due richieste quasi simultanee (due tab,
 * o login + callback) possono vedersi entrambe zero progetti e inserire entrambe. Come per l'org,
 * la promessa in corso si riusa invece di aprirne una seconda.
 */
const firstProjectFlights = new Map<string, Promise<Awaited<ReturnType<EntryDeps['createProject']>>>>();

function firstProjectOnce(
  create: EntryDeps['createProject'],
  db: Db,
  input: { orgId: string; name: string; slug: string; brandId: string | null }
): Promise<Awaited<ReturnType<EntryDeps['createProject']>>> {
  const pending = firstProjectFlights.get(input.orgId);
  if (pending) {
    return pending;
  }

  const flight = create(db, input).finally(() => firstProjectFlights.delete(input.orgId));
  firstProjectFlights.set(input.orgId, flight);
  return flight;
}

async function orgIdFor(db: Db, deps: EntryDeps, user: User, chosenOrgId: string | null): Promise<string> {
  const memberships = await deps.listMemberships(db, user.id);
  const membership = chooseOrg(memberships, chosenOrgId);
  if (membership) {
    return membership.org.id;
  }

  const { orgId } = await firstOrgOnce(deps.createFirstOrg, {
    userId: user.id,
    name: workspaceNameFor(user)
  });
  return orgId;
}

/**
 * QUALE PROGETTO, TRA PIÙ, IN ASSENZA DI UNA SCELTA ESPLICITA: quello visitato per ultimo (il
 * cookie messo da `+layout.server.ts` a ogni apertura), altrimenti il più aggiornato di recente
 * (`listProjects` ordina già così) — mai il più nuovo per nascita, che è il caso di un
 * "Untitled" appena creato e mai più toccato.
 */
async function projectIdFor(
  db: Db,
  deps: EntryDeps,
  orgId: string,
  lastProjectId: string | null
): Promise<{ projectId: string; created: boolean }> {
  const projects = (await deps.listProjects(db, orgId)).filter((p) => p.mode !== ProjectMode.Uncensored);
  if (projects.length > 0) {
    const last = lastProjectId ? projects.find((p) => p.id === lastProjectId) : undefined;
    return { projectId: (last ?? projects[0]).id, created: false };
  }

  const project = await firstProjectOnce(deps.createProject, db, {
    orgId,
    name: DEFAULT_PROJECT_NAME,
    slug: DEFAULT_PROJECT_SLUG,
    brandId: null
  });
  return { projectId: project.id, created: true };
}

async function canvasIdFor(db: Db, deps: EntryDeps, scope: { orgId: string; projectId: string }): Promise<string> {
  const canvases = await deps.listCanvases(db, scope);
  if (canvases.length > 0) {
    return canvases[0].id;
  }

  const canvas = await deps.createCanvas(db, { ...scope, name: DEFAULT_CANVAS_NAME });
  return canvas.id;
}

export async function enterApp(
  db: Db,
  deps: EntryDeps,
  user: User,
  chosenOrgId: string | null = null,
  lastProjectId: string | null = null
): Promise<Entry> {
  await deps.ensureProfile(db, user);

  const orgId = await orgIdFor(db, deps, user, chosenOrgId);
  const { projectId, created } = await projectIdFor(db, deps, orgId, lastProjectId);
  const canvasId = await canvasIdFor(db, deps, { orgId, projectId });

  return { orgId, projectId, canvasId, firstRun: created };
}

export async function homePathFor(
  db: Db,
  deps: EntryDeps,
  user: User,
  chosenOrgId: string | null = null,
  lastProjectId: string | null = null,
  campaign: Campaign | null = null,
  via: EntryVia = EntryVia.Direct
): Promise<string> {
  const entry = await enterApp(db, deps, user, chosenOrgId, lastProjectId);
  const path = canvasPath(entry.projectId, entry.canvasId);
  const arrival = arrivalOf({ campaign: campaign !== null, via, firstRun: entry.firstRun });
  if (ARRIVAL_LANDING[arrival] === Landing.Dashboard) {
    return DASHBOARD_PATH;
  }
  if (!campaign) {
    return path;
  }

  const scope = { userId: user.id, orgId: entry.orgId, projectId: entry.projectId, canvasId: entry.canvasId };
  const seeded = await deps.seedWelcome(db, scope, campaign);
  return seeded ? `${path}?${WELCOME_PARAM}=${campaign}` : path;
}
