import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import { feegaMcp } from './agents';

describe('feegaMcp', () => {
  it('names the MCP server command by absolute path, as ACP requires for stdio servers', () => {
    expect(isAbsolute(feegaMcp('/repo', 'http://127.0.0.1:5173').command)).toBe(true);
  });
});
