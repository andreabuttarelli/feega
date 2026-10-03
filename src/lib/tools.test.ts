import { describe, expect, it } from 'vitest';
import { TOOLS, ToolStatus, toolHref } from './tools';

describe('the tools registry: one row per tool on the dashboard', () => {
  it('lists the photo studio and the motion editor, in that order', () => {
    expect(TOOLS.map((t) => t.id)).toEqual(['studio', 'motion']);
  });

  it('every id is unique', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
  });

  it('an openable tool lives under /app, a coming-soon one has no route', () => {
    for (const tool of TOOLS) {
      if (tool.status === ToolStatus.ComingSoon) {
        expect(tool.route).toBeNull();
        continue;
      }
      expect(tool.route).toMatch(/^\/app\//);
    }
  });

  it('every tool says what it does in one line', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description).not.toContain('\n');
    }
  });

  it('a tool opens on the chosen project when there is one', () => {
    const studio = TOOLS.find((t) => t.id === 'studio')!;
    expect(toolHref(studio, 'p1')).toBe('/app/studio?project=p1');
    expect(toolHref(studio, null)).toBe('/app/studio');
  });

  it('a coming-soon tool has no link', () => {
    expect(toolHref({ ...TOOLS[0], status: ToolStatus.ComingSoon, route: null }, 'p1')).toBeNull();
  });
});
