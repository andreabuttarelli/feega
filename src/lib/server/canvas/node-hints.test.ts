import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { nextStepsFor, nodeTextCost } from './node-hints';

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';

const nodeRow = {
  id: NODE,
  org_id: ORG,
  project_id: 'p',
  canvas_id: CANVAS,
  type: 'text',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: { prompt: 'a' },
  version: 1,
  deleted_at: null
};

const db = () => fakeDb({ nodes: [nodeRow], nodes_connections: [], assets: [] }, { filter: true }).db;

describe('nodeTextCost', () => {
  it('counts the prompt tokens of a text node with no inputs as a fixed cost', async () => {
    const cost = await nodeTextCost(db(), { orgId: ORG, canvasId: CANVAS, nodeId: NODE, prompt: 'write a haiku', model: null });

    expect(cost.userPromptTokens).toBeGreaterThan(0);
    expect(cost.variableInput).toBe(false);
  });
});

describe('nextStepsFor', () => {
  it('suggests steps for a node of the canvas', async () => {
    const steps = await nextStepsFor(db(), { orgId: ORG, canvasId: CANVAS, nodeId: NODE });

    expect(Array.isArray(steps)).toBe(true);
    expect(steps![0]).toHaveProperty('confidence');
  });

  it('answers null for a node that is not on the canvas', async () => {
    expect(await nextStepsFor(db(), { orgId: ORG, canvasId: CANVAS, nodeId: 'missing' })).toBeNull();
  });
});
