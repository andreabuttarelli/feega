import { describe, expect, it } from 'vitest';
import { ADDABLE_LABEL } from './addable';
import { CONNECTOR_STYLE } from './connectors';
import { NODE_KIND_LABEL } from './node-label';

describe('the motion node is called Frame wherever a person reads it', () => {
  it('in the add bar, on the node and on its output', () => {
    expect(ADDABLE_LABEL.motion).toBe('Frame');
    expect(CONNECTOR_STYLE.motions.label).toBe('Frame');
    expect(NODE_KIND_LABEL.motion).toBe('Frame');
  });

});
