// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEVICE_SCRIPT } from './device-runtime';

type Corner = { clone: () => { applyMatrix4: () => { project: () => { x: number; y: number; z: number } } } };

const corner: Corner = { clone: () => ({ applyMatrix4: () => ({ project: () => ({ x: 0, y: 0, z: 0.5 }) }) }) };

function placeFaces(): (c: unknown, s: unknown) => void {
  return new Function('faceShown', 'quadMatrix', 'DEG', `${DEVICE_SCRIPT}; return placeFaces;`)(() => true, () => 'none', Math.PI / 180);
}

function stage(clipVisibility: string) {
  document.body.innerHTML = `<div id="clip" style="visibility:${clipVisibility}"><div id="dsf-dev-0" style="visibility:hidden"></div></div>`;
  const c = { id: 'dev', screen: { stage: { left: 0, top: 0, width: 100, height: 100 }, faces: [{ w: 10, h: 10 }] } };
  const s = { device: { slot: { faces: [{ mesh: { matrixWorld: null }, corners: [corner, corner, corner, corner] }] } }, scene: { updateMatrixWorld: () => {} }, camera: { updateMatrixWorld: () => {} } };
  placeFaces()(c, s);
  return getComputedStyle(document.getElementById('dsf-dev-0')!).visibility;
}

describe('a live screen on a device', () => {
  it('disappears with its device clip once the clip is out of range', () => {
    expect(stage('hidden')).toBe('hidden');
  });

  it('shows while its device clip is on screen', () => {
    expect(stage('visible')).toBe('visible');
  });
});
