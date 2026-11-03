import { describe, expect, it } from 'vitest';
import { listed } from './frame-lists';

describe('a frame keeps only the display lists it can still show', () => {
  it('a new list drops the frame’s older lists nobody shows any more', () => {
    const lists = new Map([
      ['a:1', 'a1'],
      ['a:live1', 'live1'],
      ['b:1', 'b1']
    ]);

    const next = listed(lists, 'a', 'a:live2', 'live2', []);

    expect([...next.keys()]).toEqual(['b:1', 'a:live2']);
  });

  it('a list still shown or held on screen stays', () => {
    const lists = new Map([
      ['a:1', 'a1'],
      ['a:live1', 'live1'],
      ['a:live2', 'live2']
    ]);

    const next = listed(lists, 'a', 'a:live3', 'live3', ['a:1', 'a:live2', undefined]);

    expect([...next.keys()].sort()).toEqual(['a:1', 'a:live2', 'a:live3']);
  });

  it('a frame whose id prefixes another frame’s id leaves that frame alone', () => {
    const lists = new Map([['ab:1', 'other']]);

    expect([...listed(lists, 'a', 'a:2', 'mine', []).keys()].sort()).toEqual(['a:2', 'ab:1']);
  });

  it('a hundred live edits keep the map at one list per frame', () => {
    let lists = new Map<string, number>();
    for (let g = 1; g <= 100; g++) {
      lists = listed(lists, 'a', `a:live${g}`, g, [`a:live${g - 1}`]);
    }

    expect(lists.size).toBe(2);
  });
});
