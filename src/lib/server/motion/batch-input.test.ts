import { describe, expect, it } from 'vitest';
import { batchInput, rowRequests } from './batch-input';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { exposeField, FieldType } from '$lib/motion/template/fields';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import { MAX_BATCH_ROWS } from '$lib/motion/template/batch';

function template(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 't1');
  const exposed = added.ok ? exposeField(added.doc, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' }) : added;
  if (!exposed.ok) {
    throw new Error(exposed.error);
  }
  return exposed.doc;
}

describe('batchInput', () => {
  it('reads rows of field values with their output names', () => {
    expect(batchInput(JSON.stringify([{ name: 'a', values: { headline: 'A' } }]))).toEqual({ ok: true, rows: [{ name: 'a', values: { headline: 'A' } }] });
  });

  it('no rows, too many rows or junk are refused', () => {
    expect(batchInput('[]')).toMatchObject({ ok: false });
    expect(batchInput(JSON.stringify(Array.from({ length: MAX_BATCH_ROWS + 1 }, () => ({ name: 'x', values: {} }))))).toMatchObject({ ok: false });
    expect(batchInput('nope')).toMatchObject({ ok: false });
  });
});

describe('rowRequests', () => {
  it('each row renders the template with its own values filled in', () => {
    const made = rowRequests({ version: 4, doc: template() }, [{ name: 'a', values: { headline: 'Zqx1one' } }, { name: 'b', values: { headline: 'Zqx2two' } }], { tokens: FEEGA_TOKENS, assets: {} }, settingsOf(Preset.Social));

    expect(made.ok && made.rows.map((r) => [r.name, r.req.version, r.req.job.html.includes('Zqx1one'), r.req.job.html.includes('Zqx2two')])).toEqual([
      ['a', 4, true, false],
      ['b', 4, false, true]
    ]);
  });

  it('a value of the wrong type names its row', () => {
    const doc = template();
    const typed = { ...doc, fields: doc.fields.map((f) => ({ ...f, type: FieldType.Number })) };

    expect(rowRequests({ version: 1, doc: typed }, [{ name: 'a', values: { headline: 'x' } }], { tokens: FEEGA_TOKENS, assets: {} }, settingsOf(Preset.Social))).toEqual({ ok: false, error: 'row 1: headline expects a number, got "x"' });
  });
});
