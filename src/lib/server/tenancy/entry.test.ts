import { describe, expect, it, vi } from 'vitest';
import {
  ARRIVAL_LANDING,
  Arrival,
  DASHBOARD_PATH,
  DEFAULT_CANVAS_NAME,
  DEFAULT_PROJECT_NAME,
  EntryVia,
  Landing,
  arrivalOf,
  canvasPath,
  enterApp,
  homePathFor,
  workspaceNameFor
} from '$lib/server/tenancy/entry';
import type { Db } from '$lib/server/db/client';
import type { Membership } from '$lib/server/repos/orgs';
import type { User } from '@supabase/supabase-js';

const ORG = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const PROJECT = '33333333-3333-3333-3333-333333333333';
const CANVAS = '44444444-4444-4444-4444-444444444444';

const user = { id: USER, email: 'chi@esempio.it', user_metadata: {} } as unknown as User;

const membership: Membership = { org: { id: ORG, name: 'chi', slug: 'chi-abcd' }, role: 'owner' };
const project = { id: PROJECT, name: DEFAULT_PROJECT_NAME, slug: 'untitled', brandId: null, archivedAt: null, lastActiveAt: '2026-09-21T00:00:00Z' };
const canvas = { id: CANVAS, projectId: PROJECT, name: DEFAULT_CANVAS_NAME, viewport: null };

/** I collaboratori del bootstrap, sostituiti uno per uno: il test guarda QUANTE volte si crea. */
function deps(overrides: Partial<Parameters<typeof enterApp>[1]>) {
  return {
    ensureProfile: vi.fn(async () => ({ id: USER, email: 'chi@esempio.it', name: null, avatarUrl: null })),
    listMemberships: vi.fn(async () => [membership]),
    createFirstOrg: vi.fn(async () => ({ orgId: ORG, slug: 'chi-abcd', role: 'owner' as const })),
    listProjects: vi.fn(async () => [project]),
    createProject: vi.fn(async () => project),
    listCanvases: vi.fn(async () => [canvas]),
    createCanvas: vi.fn(async () => canvas),
    seedWelcome: vi.fn(async () => true),
    ...overrides
  };
}

const db = {} as Db;

describe('il nome di uno spazio nuovo non si chiede a nessuno', () => {
  it("viene dalla parte locale dell'email", () => {
    expect(workspaceNameFor({ ...user, email: 'andrea@teta.so' } as User)).toBe('andrea');
  });

  it('senza email resta un nome neutro, non una stringa vuota', () => {
    expect(workspaceNameFor({ ...user, email: null } as unknown as User)).toBe('My workspace');
  });
});

describe('entrare la prima volta crea tutto, una volta sola', () => {
  it('due schede al primo accesso non creano due organizzazioni', async () => {
    const d = deps({ listMemberships: vi.fn(async () => []) });
    await Promise.all([enterApp(db, d, user), enterApp(db, d, user)]);
    expect(d.createFirstOrg).toHaveBeenCalledOnce();
  });
  it('un utente senza org ne riceve una, con progetto e tela', async () => {
    const d = deps({ listMemberships: vi.fn(async () => []) });

    const entry = await enterApp(db, d, user);

    expect(d.createFirstOrg).toHaveBeenCalledOnce();
    expect(entry).toMatchObject({ orgId: ORG, projectId: PROJECT, canvasId: CANVAS });
  });

  it('il profilo nasce prima di tutto: orgs_members lo referenzia', async () => {
    const d = deps({ listMemberships: vi.fn(async () => []) });

    await enterApp(db, d, user);

    expect(d.ensureProfile).toHaveBeenCalledOnce();
  });

  it('un progetto nasce senza brand: è il caso normale', async () => {
    const d = deps({ listMemberships: vi.fn(async () => []), listProjects: vi.fn(async () => []) });

    await enterApp(db, d, user);

    expect(d.createProject).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: ORG, brandId: null }));
  });

  it('due schede sulla stessa org vuota non creano due progetti "Untitled"', async () => {
    const d = deps({ listProjects: vi.fn(async () => []) });

    await Promise.all([enterApp(db, d, user), enterApp(db, d, user)]);

    expect(d.createProject).toHaveBeenCalledOnce();
  });
});

describe('entrare la seconda volta non duplica niente', () => {
  it('riapre lo spazio scelto quando l utente appartiene a più org', async () => {
    const chosenOrg = '55555555-5555-5555-5555-555555555555';
    const d = deps({ listMemberships: vi.fn(async () => [
      membership,
      { ...membership, org: { ...membership.org, id: chosenOrg } }
    ]) });

    const entry = await enterApp(db, d, user, chosenOrg);

    expect(entry.orgId).toBe(chosenOrg);
    expect(d.listProjects).toHaveBeenCalledWith(db, chosenOrg);
  });

  it("chi ha già un'org non ne crea un'altra", async () => {
    const d = deps({});

    await enterApp(db, d, user);

    expect(d.createFirstOrg).not.toHaveBeenCalled();
  });

  it('chi ha già un progetto non ne crea un altro', async () => {
    const d = deps({});

    await enterApp(db, d, user);

    expect(d.createProject).not.toHaveBeenCalled();
  });

  it('chi ha già una tela ci rientra dentro', async () => {
    const d = deps({});

    const entry = await enterApp(db, d, user);

    expect(d.createCanvas).not.toHaveBeenCalled();
    expect(entry.canvasId).toBe(CANVAS);
  });

  it('un progetto senza tele ne riceve una, senza toccare il progetto', async () => {
    const d = deps({ listCanvases: vi.fn(async () => []) });

    await enterApp(db, d, user);

    expect(d.createProject).not.toHaveBeenCalled();
    expect(d.createCanvas).toHaveBeenCalledOnce();
  });
});

describe('con più progetti, atterra su quello usato per ultimo', () => {
  const usedProject = { ...project, id: PROJECT };
  const emptyDuplicate = {
    id: '66666666-6666-6666-6666-666666666666',
    name: DEFAULT_PROJECT_NAME,
    slug: 'untitled',
    brandId: null,
    archivedAt: null,
    lastActiveAt: '2026-09-24T10:00:00Z'
  };

  it('con un cookie di ultimo progetto, lo riapre anche se non è il più recente', async () => {
    const d = deps({ listProjects: vi.fn(async () => [emptyDuplicate, usedProject]) });

    const entry = await enterApp(db, d, user, null, PROJECT);

    expect(entry.projectId).toBe(PROJECT);
  });

  it('senza cookie, atterra sul progetto aggiornato più di recente', async () => {
    const d = deps({ listProjects: vi.fn(async () => [emptyDuplicate, usedProject]) });

    const entry = await enterApp(db, d, user);

    expect(entry.projectId).toBe(emptyDuplicate.id);
  });
});

describe('la tela ha un indirizzo, e non è quello del brand', () => {
  it('il percorso è scopato sulla tela, non sul brand', () => {
    expect(canvasPath(PROJECT, CANVAS)).toBe(`/p/${PROJECT}/c/${CANVAS}`);
  });
});

describe('where an arrival lands: one rule table', () => {
  it('a returning user lands on the dashboard', async () => {
    expect(await homePathFor(db, deps({}), user)).toBe(DASHBOARD_PATH);
  });

  it('a first-run user goes straight to the canvas the bootstrap built', async () => {
    const d = deps({ listMemberships: vi.fn(async () => []), listProjects: vi.fn(async () => []) });

    const path = await homePathFor(db, d, user);

    expect(path).toBe(`/p/${PROJECT}/c/${CANVAS}`);
    expect(d.createFirstOrg).toHaveBeenCalledOnce();
  });

  it('an invited user opens the invited org canvas, not the dashboard of another org', async () => {
    expect(await homePathFor(db, deps({}), user, ORG, null, null, EntryVia.Invite)).toBe(`/p/${PROJECT}/c/${CANVAS}`);
  });

  it('the table names a landing for every arrival', () => {
    expect(ARRIVAL_LANDING).toEqual({
      [Arrival.Returning]: Landing.Dashboard,
      [Arrival.FirstRun]: Landing.Canvas,
      [Arrival.Campaign]: Landing.Canvas,
      [Arrival.Invite]: Landing.Canvas
    });
  });

  it.each([
    [{ campaign: true, via: EntryVia.Invite, firstRun: true }, Arrival.Campaign],
    [{ campaign: false, via: EntryVia.Invite, firstRun: true }, Arrival.Invite],
    [{ campaign: false, via: EntryVia.Direct, firstRun: true }, Arrival.FirstRun],
    [{ campaign: false, via: EntryVia.Direct, firstRun: false }, Arrival.Returning]
  ])('%o is a %s arrival', (input, arrival) => {
    expect(arrivalOf(input)).toBe(arrival);
  });

  it('rispetta l org scelta quando ce ne sono più di una', async () => {
    const chosenOrg = '55555555-5555-5555-5555-555555555555';
    const d = deps({
      listMemberships: vi.fn(async () => [membership, { ...membership, org: { ...membership.org, id: chosenOrg } }])
    });

    await homePathFor(db, d, user, chosenOrg);

    expect(d.listProjects).toHaveBeenCalledWith(db, chosenOrg);
  });
});

describe('a landing campaign lands with its template', () => {
  it('the canvas path carries the campaign when the template was inserted', async () => {
    const d = deps({});

    const path = await homePathFor(db, d, user, null, null, 'anime-video-generator');

    expect(d.seedWelcome).toHaveBeenCalledWith(db, { userId: USER, orgId: ORG, projectId: PROJECT, canvasId: CANVAS }, 'anime-video-generator');
    expect(path).toBe(`/p/${PROJECT}/c/${CANVAS}?welcome=anime-video-generator`);
  });

  it('no campaign, no seeding', async () => {
    const d = deps({});

    expect(await homePathFor(db, d, user)).toBe(DASHBOARD_PATH);
    expect(d.seedWelcome).not.toHaveBeenCalled();
  });

  it('a campaign a tool serves lands on that tool, in the same project, after seeding its canvas', async () => {
    const d = deps({});

    const path = await homePathFor(db, d, user, null, null, 'ai-video-upscaler');

    expect(d.seedWelcome).toHaveBeenCalled();
    expect(path).toBe(`/app/upscale?project=${PROJECT}`);
  });

  it('a campaign already spent lands on the plain canvas', async () => {
    const d = deps({ seedWelcome: vi.fn(async () => false) });

    expect(await homePathFor(db, d, user, null, null, 'claymation-ai')).toBe(`/p/${PROJECT}/c/${CANVAS}`);
  });
});
