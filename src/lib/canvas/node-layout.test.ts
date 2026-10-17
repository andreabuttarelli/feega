import { describe, expect, it } from 'vitest';
import { validateNewNodeData, validateNodeData } from './node-data';
import { dragAngle, followGroup, undoTurn, scaleGroup, rotateGroup, translateGroup, layoutOf } from './node-layout';

describe('every node carries its own layout: rotation and group', () => {
  it('keeps rotation and groupId through validation, for any type', () => {
    expect(validateNodeData('motion', { format: '16:9', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null, rotation: 30, groupId: 'g1' })).toMatchObject({ ok: true, data: { rotation: 30, groupId: 'g1' } });
    expect(validateNodeData('text', { prompt: 'p', rotation: -45 })).toMatchObject({ ok: true, data: { rotation: -45 } });
  });

  it('a new node may be created already turned', () => {
    expect(validateNewNodeData('text', { prompt: 'p', rotation: 15 })).toMatchObject({ ok: true, data: { rotation: 15 } });
  });

  it('refuses a rotation that is not a finite angle', () => {
    expect(validateNodeData('text', { prompt: 'p', rotation: 'a lot' }).ok).toBe(false);
  });

  it('reads no rotation as 0 and no group as none', () => {
    expect(layoutOf({})).toEqual({ rotation: 0, groupId: null });
  });
});

const group = { id: 'g', x: 0, y: 0, w: 200, h: 100, rotation: 0 };
const frame = { id: 'f', x: 150, y: 25, w: 40, h: 50, rotation: 0 };

describe('rotating a group', () => {
  it('turns the group and each member around the group centre, keeping relative distances', () => {
    const turned = rotateGroup(group, [frame], 90);
    const g = turned.find((n) => n.id === 'g')!;
    const f = turned.find((n) => n.id === 'f')!;

    expect(g).toMatchObject({ x: 0, y: 0, rotation: 90 });
    expect(f.rotation).toBe(90);
    expect(f.x + f.w / 2).toBeCloseTo(100, 5);
    expect(f.y + f.h / 2).toBeCloseTo(50 + 70, 5);
  });

  it('wraps angles into -180..180', () => {
    expect(rotateGroup({ ...group, rotation: 170 }, [], 30)[0].rotation).toBe(-160);
  });
});

describe('moving a group', () => {
  it('moves every member by the same delta', () => {
    expect(translateGroup([frame], { dx: 10, dy: -5 })).toEqual([{ id: 'f', x: 160, y: 20 }]);
  });
});

describe('the rotate handle', () => {
  it('turns by the angle swept around the centre, snapping to 15° with Shift', () => {
    const centre = { x: 0, y: 0 };
    expect(dragAngle(centre, { x: 0, y: -10 }, { x: 10, y: 0 })).toBeCloseTo(90, 5);
    expect(dragAngle(centre, { x: 0, y: -10 }, { x: 10, y: -1 }, 15)).toBe(90);
  });
});

describe('scaling a group', () => {
  it('scales each member about the group corner, sizes included', () => {
    const [g, f] = scaleGroup(group, [frame], { w: 400, h: 50 });

    expect(g).toMatchObject({ x: 0, y: 0, w: 400, h: 50 });
    expect(f).toMatchObject({ id: 'f', x: 300, y: 12.5, w: 80, h: 25 });
  });
});

describe('members follow a group while it is dragged', () => {
  it('shift each member by how far the group has moved from where the drag began', () => {
    const origins = new Map([['g', { x: 0, y: 0 }], ['f', { x: 150, y: 25 }]]);

    expect(followGroup(origins, 'g', { x: 30, y: -10 }, ['f'])).toEqual([{ id: 'f', x: 180, y: 15 }]);
  });
});

describe('undoing a turn', () => {
  it('is the same turn the other way, and undoing that gives the turn back', () => {
    expect(undoTurn({ id: 'g', degrees: 30 })).toEqual({ id: 'g', degrees: -30 });
    expect(undoTurn(undoTurn({ id: 'g', degrees: 30 }))).toEqual({ id: 'g', degrees: 30 });
  });
});
