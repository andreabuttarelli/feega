import { describe, expect, it } from 'vitest';
import { NOTHING_HIDDEN, exclusionsFor, touchesHidden } from './hidden-scope';

const HIDDEN = { projectIds: ['p-n'], canvasIds: ['c-n'], nodeIds: ['n-n'] };

describe('what an agent outside the Uncensored workspace cannot see', () => {
  it.each([
    ['projects', [['id', ['p-n']]]],
    ['nodes', [['project_id', ['p-n']]]],
    ['assets', [['project_id', ['p-n']]]],
    ['nodes_connections', [['canvas_id', ['c-n']]]],
    ['node_runs', [['node_id', ['n-n']]]],
    ['brands', []]
  ])('%s excludes %o', (table, exclusions) => {
    expect(exclusionsFor(table, HIDDEN)).toEqual(exclusions);
  });

  it('a verified caller hides nothing', () => {
    expect(exclusionsFor('nodes', NOTHING_HIDDEN)).toEqual([]);
  });

  it('a row pointing into an uncensored project, canvas or node is refused', () => {
    expect(touchesHidden('nodes', { project_id: 'p-n' }, HIDDEN)).toBe(true);
    expect(touchesHidden('nodes_connections', { canvas_id: 'c-n' }, HIDDEN)).toBe(true);
    expect(touchesHidden('nodes', { project_id: 'p-ok' }, HIDDEN)).toBe(false);
  });
});
