import { describe, expect, it } from 'vitest';
import { Backend, nextBackend } from './backend';

describe('nextBackend — where a lost GPU context falls back to', () => {
  it('WebGPU falls back to WebGL2, WebGL2 to the DOM canvas', () => {
    expect(nextBackend(Backend.WebGPU)).toBe(Backend.WebGL);
    expect(nextBackend(Backend.WebGL)).toBeNull();
  });
});
