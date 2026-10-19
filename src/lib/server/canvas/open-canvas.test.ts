import { describe, expect, it } from 'vitest';
import { openCanvasForUser } from '$lib/server/canvas/lookup';
import { fakeDb } from '$lib/server/db/fake-db';

const ORG = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const PROJECT = '44444444-4444-4444-4444-444444444444';

const member = (orgId: string) => ({ role: 'owner', created_at: '2026-01-01', user_id: USER, orgs: { id: orgId, name: 'Acme', slug: 'acme' }, profiles: { active_org_id: orgId } });
const canvas = (orgId: string) => ({ id: CANVAS, org_id: orgId, project_id: PROJECT, name: 'Untitled', viewport: null, projects: { mode: 'standard', brand_id: null } });

function watched(rows: Record<string, unknown[]>) {
  const fake = fakeDb(rows);
  const asked: string[] = [];
  const from = fake.db.from.bind(fake.db);
  fake.db.from = ((table: string) => {
    asked.push(table);
    return from(table as never);
  }) as unknown as typeof fake.db.from;
  return { db: fake.db, asked };
}

describe('aprire una tela per una persona', () => {
  it('la tela si chiede insieme alle appartenenze, non dopo: un giro di rete in meno a ogni apertura', () => {
    const { db, asked } = watched({ orgs_members: [member(ORG)], canvases: [canvas(ORG)] });

    void openCanvasForUser(db, { userId: USER, canvasId: CANVAS });

    expect(asked).toEqual(expect.arrayContaining(['orgs_members', 'canvases']));
  });

  it("torna la tela con l'org che la contiene", async () => {
    const { db } = watched({ orgs_members: [member(ORG)], canvases: [canvas(ORG)] });

    const opened = await openCanvasForUser(db, { userId: USER, canvasId: CANVAS });

    expect(opened.found).toEqual({ orgId: ORG, canvas: { id: CANVAS, projectId: PROJECT, name: 'Untitled', viewport: null }, mode: 'standard', projectBrandId: null });
  });

  it("una tela di un'org di cui non è membro non si apre, anche se il database la restituisce", async () => {
    const { db } = watched({ orgs_members: [member(ORG)], canvases: [canvas(OTHER)] });

    expect((await openCanvasForUser(db, { userId: USER, canvasId: CANVAS })).found).toBeNull();
  });
});
