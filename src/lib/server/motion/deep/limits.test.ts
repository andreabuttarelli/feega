import { describe, expect, it } from 'vitest';
import { Runtime, StillsEngine, stillsEngine } from './limits';

describe('where the critic frames are rendered', () => {
  it('renders on this machine in dev, so a test never pays for the farm', () => {
    expect(stillsEngine(Runtime.Dev)).toBe(StillsEngine.Machine);
  });

  it('renders on the farm once deployed, where there is no local browser', () => {
    expect(stillsEngine(Runtime.Deployed)).toBe(StillsEngine.Farm);
  });
});
