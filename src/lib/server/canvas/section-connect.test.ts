import { describe, expect, it } from 'vitest';
import { connectVerdict } from './node-model';

const section = { type: 'section', data: {} };
const node = (type: string) => ({ type, data: {} });

describe('connecting a section', () => {
  it('feeds any generative node', () => {
    for (const type of ['text', 'image', 'video']) {
      expect(connectVerdict(section, node(type))).toBeNull();
    }
  });

  it('cannot feed a node that is not generated', () => {
    expect(connectVerdict(section, node('doc'))).not.toBeNull();
    expect(connectVerdict(section, section)).not.toBeNull();
  });
});
