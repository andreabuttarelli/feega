// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEVICE_SCRIPT } from './device-runtime';

type Corner = { clone: () => { applyMatrix4: () => { project: () => { x: number; y: number; z: number } } } };

enum Facing {
  Camera = 'camera',
  Away = 'away'
}

const corner: Corner = { clone: () => ({ applyMatrix4: () => ({ project: () => ({ x: 0, y: 0, z: 0.5 }) }) }) };

function placeFaces(facing: Facing): (c: unknown, s: unknown) => void {
  return new Function('faceShown', 'quadMatrix', 'DEG', `${DEVICE_SCRIPT}; return placeFaces;`)(() => facing === Facing.Camera, () => 'none', Math.PI / 180);
}

function place(clipVisibility: string, facing: Facing) {
  document.body.innerHTML = `<div id="clip" style="visibility:${clipVisibility}"><div id="dsf-dev-0"><div id="live" style="visibility:visible"></div></div></div>`;
  const c = { id: 'dev', screen: { stage: { left: 0, top: 0, width: 100, height: 100 }, faces: [{ w: 10, h: 10 }] } };
  const s = { device: { slot: { faces: [{ mesh: { matrixWorld: null }, corners: [corner, corner, corner, corner] }] } }, scene: { updateMatrixWorld: () => {} }, camera: { updateMatrixWorld: () => {} } };
  placeFaces(facing)(c, s);
  return getComputedStyle(document.getElementById('dsf-dev-0')!);
}

describe('a live screen on a device', () => {
  it('disappears with its device clip once the clip is out of range', () => {
    expect(place('hidden', Facing.Camera).visibility).toBe('hidden');
  });

  it('shows while its device clip is on screen', () => {
    const face = place('visible', Facing.Camera);

    expect([face.visibility, face.opacity]).toEqual(['visible', '1']);
  });

  it('turned away from the camera, it hides even the clips the runtime forces visible inside it', () => {
    expect(place('visible', Facing.Away).opacity).toBe('0');
  });
});
