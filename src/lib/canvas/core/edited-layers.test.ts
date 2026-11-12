import { describe, expect, it } from 'vitest';
import { editedLayers } from './edited-layers';

const layer = (id: string, group: string) => ({ id, group });

describe('editedLayers', () => {
  it('picks the layers showing a frame mid-edit, so a gesture never holds back the edit itself', () => {
    const held = [layer('a', 'a:live3'), layer('b', 'b:base'), layer('c', 'c:live1')];
    const live = new Map([
      ['a', 'a:live3'],
      ['c', 'c:live2']
    ]);

    expect(editedLayers(held, live)).toEqual([layer('a', 'a:live3')]);
  });
});
