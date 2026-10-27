import { describe, it, expect } from 'vitest';
import { describeEdit } from './describe-edit';
import { Family, editCatalogue } from './edit-catalogue';

const BARE_MAX_CHARS = 3_000;

describe('describe lists every edit op, and gives strict schemas', () => {
  it('with nothing asked, only the families: counts by access and one line, under 3 KB', async () => {
    const answer = await describeEdit({});

    expect(JSON.stringify(answer).length).toBeLessThan(BARE_MAX_CHARS);
    expect(answer).toMatchObject({ families: expect.arrayContaining([expect.objectContaining({ family: 'frame', about: expect.any(String) })]) });
    const total = (answer as { families: { ops: number }[] }).families.reduce((n, f) => n + f.ops, 0);
    expect(total).toBe(editCatalogue().size);
  });

  it('a family gives its op names, access and one line each', async () => {
    const canvas = await describeEdit({ family: Family.Canvas });
    const frame = await describeEdit({ family: Family.Frame });

    expect('ops' in canvas && canvas.ops).toContainEqual(expect.objectContaining({ name: 'move_node', access: 'write' }));
    expect('ops' in frame && frame.ops).toContainEqual(expect.objectContaining({ name: 'add_shape', access: 'write' }));
    expect('ops' in frame && frame.ops).toContainEqual(expect.objectContaining({ name: 'generate_voiceover', access: 'spend' }));
  });

  it('reads are tagged read, and what needs the editor says so', async () => {
    const frame = await describeEdit({ family: Family.Frame });
    const access = (name: string) => (frame as { ops: { name: string; access: string }[] }).ops.find((o) => o.name === name)?.access;

    expect(access('list_shots')).toBe('read');
    expect(access('get_motion_doc')).toBe('read');
    expect(access('recreate_ui')).toBe('editor');
  });

  it('one op gives its JSON schema, from whichever registry owns it', async () => {
    const canvas = await describeEdit({ op: 'move_node' });
    const frame = await describeEdit({ op: 'add_shape' });
    const editor = await describeEdit({ op: 'editor_list_fonts' });

    expect(canvas).toMatchObject({ op: 'move_node', family: 'canvas', input_schema: { type: 'object' } });
    expect(frame).toMatchObject({ op: 'add_shape', family: 'frame', input_schema: { type: 'object' } });
    expect(editor).toMatchObject({ op: 'editor_list_fonts', family: 'editor' });
  });

  it('several ops give several schemas in one call', async () => {
    const answer = await describeEdit({ ops: ['move_node', 'add_shape'] });

    expect(answer).toMatchObject({ schemas: [{ op: 'move_node' }, { op: 'add_shape' }] });
  });

  it('schemas: true gives every op with its schema', async () => {
    const answer = await describeEdit({ schemas: true });

    expect('schemas' in answer && answer.schemas).toHaveLength(editCatalogue().size);
  });

  it('an unknown op answers the list', async () => {
    expect(await describeEdit({ op: 'nope' })).toMatchObject({ error: 'unknown_op' });
  });
});
