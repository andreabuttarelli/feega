import { describe, expect, it } from 'vitest';
import { NodeProblem, checkNode } from './node-check';

const tools = (versions: Record<string, string | Error>) => async (command: string) => {
  const found = versions[command];
  if (found instanceof Error || found === undefined) {
    throw new Error('not found');
  }
  return found;
};

describe('node check', () => {
  it('passes with a supported node and npm', async () => {
    expect(await checkNode(tools({ node: 'v22.1.0\n', npm: '10.2.0\n' }))).toEqual({ ok: true, node: '22.1.0' });
  });

  it('reports a missing node first', async () => {
    expect(await checkNode(tools({ npm: '10.2.0' }))).toMatchObject({ ok: false, problem: NodeProblem.NodeMissing });
  });

  it('reports a node that is too old, with the version found', async () => {
    const out = await checkNode(tools({ node: 'v18.19.0', npm: '10.2.0' }));

    expect(out).toMatchObject({ ok: false, problem: NodeProblem.NodeOld });
    expect(out.ok ? '' : out.message).toContain('18.19.0');
  });

  it('reports a missing npm', async () => {
    expect(await checkNode(tools({ node: 'v22.1.0' }))).toMatchObject({ ok: false, problem: NodeProblem.NpmMissing });
  });
});
