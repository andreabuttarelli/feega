import { describe, expect, it } from 'vitest';
import { templatesDb } from './templates-testing';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { exposeField, FieldType } from '$lib/motion/template/fields';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { templateLibrary } from './templates';

function withField(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 't1');
  const exposed = added.ok ? exposeField(added.doc, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' }) : added;
  if (!exposed.ok) {
    throw new Error(exposed.error);
  }
  return exposed.doc;
}

const scope = { orgId: 'org-a', actor: { kind: 'user' as const, id: 'u1' } };

describe('the motion template library of an org', () => {
  it('lists the built-in templates before anything is saved', async () => {
    const { db } = templatesDb();

    expect((await templateLibrary(db, scope).list()).map((e) => e.id)).toEqual(BUILTIN_TEMPLATES.map((e) => e.id));
  });

  it('a saved template is stored for the org and listed after the built-ins', async () => {
    const { db, rows } = templatesDb();
    const library = templateLibrary(db, scope);

    const saved = await library.save({ doc: withField(), compId: null, meta: { name: 'Promo' }, posterFrame: 12 });

    expect(saved).toMatchObject({ ok: true, entry: { id: 't1', template: { name: 'Promo' } } });
    expect(rows[0]).toMatchObject({ org_id: 'org-a', name: 'Promo', poster_frame: 12, actor_kind: 'user', actor_id: 'u1' });
    expect((await library.list()).at(-1)).toMatchObject({ id: 't1', template: { name: 'Promo' } });
  });

  it('another org does not see it', async () => {
    const { db } = templatesDb();
    await templateLibrary(db, scope).save({ doc: withField(), compId: null, meta: { name: 'Promo' }, posterFrame: 0 });

    expect(await templateLibrary(db, { ...scope, orgId: 'org-b' }).list()).toHaveLength(BUILTIN_TEMPLATES.length);
  });

  it('a doc with no exposed field is refused before any write', async () => {
    const { db, rows } = templatesDb();

    expect(await templateLibrary(db, scope).save({ doc: newMotionDoc(MotionFormat.Landscape), compId: null, meta: { name: 'Empty' }, posterFrame: 0 })).toMatchObject({ ok: false });
    expect(rows).toEqual([]);
  });

  it('a stored row whose doc no longer parses is skipped, not thrown', async () => {
    const { db } = templatesDb([{ id: 'bad', org_id: 'org-a', name: 'Old', description: '', doc: { version: 0 } }]);

    expect(await templateLibrary(db, scope).list()).toHaveLength(BUILTIN_TEMPLATES.length);
  });

  it('built-ins cannot be removed; an org template can', async () => {
    const { db } = templatesDb();
    const library = templateLibrary(db, scope);
    await library.save({ doc: withField(), compId: null, meta: { name: 'Promo' }, posterFrame: 0 });

    expect(await library.remove(BUILTIN_TEMPLATES[0].id)).toBe(false);
    expect(await library.remove('t1')).toBe(true);
  });
});
