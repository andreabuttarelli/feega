import { describe, it, expect } from 'vitest';
import { describeEdit } from './describe-edit';
import { editCatalogue } from './edit-catalogue';

describe('describe lists every edit op, and gives strict schemas', () => {
  it('with nothing asked, every op with its family, access and one line', async () => {
    const answer = await describeEdit({});

    expect('ops' in answer && answer.ops).toHaveLength(editCatalogue().size);
    expect('ops' in answer && answer.ops).toContainEqual(expect.objectContaining({ name: 'move_node', family: 'canvas', access: 'write' }));
    expect('ops' in answer && answer.ops).toContainEqual(expect.objectContaining({ name: 'add_shape', family: 'frame', access: 'write' }));
    expect('ops' in answer && answer.ops).toContainEqual(expect.objectContaining({ name: 'generate_voiceover', access: 'spend' }));
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
