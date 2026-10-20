import { describe, it, expect } from 'vitest';
import { Family, editCatalogue } from '$lib/server/edit/edit-catalogue';
import { describeEdit } from '$lib/server/edit/describe-edit';
import { SHOWCASE_CANVAS_OPS, SHOWCASE_MOTION_TOOLS } from './mcp-showcase-parity';

const namesOf = (family: Family) => [...editCatalogue().values()].filter((o) => o.family === family).map((o) => o.name);

describe('the surface the design showcase was built with is the one the edit tool reaches', () => {
  it('every canvas op the showcase scripts called is an edit canvas op', () => {
    expect(namesOf(Family.Canvas)).toEqual(expect.arrayContaining([...SHOWCASE_CANVAS_OPS]));
  });

  it('every motion tool the showcase scripts called is an edit frame op', () => {
    expect(namesOf(Family.Frame)).toEqual(expect.arrayContaining([...SHOWCASE_MOTION_TOOLS]));
  });

  it('describe gives a strict schema for each of them', async () => {
    const answer = await describeEdit({ ops: [...SHOWCASE_CANVAS_OPS, ...SHOWCASE_MOTION_TOOLS] });

    const schemas = 'schemas' in answer ? (answer.schemas ?? []) : [];

    expect(schemas).toHaveLength(SHOWCASE_CANVAS_OPS.length + SHOWCASE_MOTION_TOOLS.length);
    expect(schemas.every((s) => (s.input_schema as { type?: string })?.type === 'object')).toBe(true);
  });
});
