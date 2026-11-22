import { describe, expect, it, vi } from 'vitest';
import { OpKind, Place, type Proposal } from '@feega/plugin-api/protocol';
import { DepsOutcome } from './deps';
import { INSTALL_LABEL, dependenciesOf, offerInstall } from './install-offer';

const dep = (name: string) => ({ kind: OpKind.Dependency, name, version: '^1.0.0' }) as const;

describe('dependenciesOf', () => {
  it('lists the packages a proposal adds, once each', () => {
    const proposal: Proposal = { label: 'x', ops: [dep('three'), dep('@types/three'), dep('three'), { kind: OpKind.Insert, at: 'a:1:1', place: Place.Child, component: { name: 'A', file: 'a.svelte', source: '' } }] };
    expect(dependenciesOf(proposal)).toEqual(['three', '@types/three']);
  });

  it('is empty when the proposal adds none', () => {
    expect(dependenciesOf({ label: 'x', ops: [{ kind: OpKind.Style, at: 'a:1:1', css: {} }] })).toEqual([]);
  });
});

function setup(confirmed: boolean, outcome: DepsOutcome | { failure: string; line: string } = DepsOutcome.Installed) {
  const say = vi.fn();
  const confirm = vi.fn(async () => confirmed);
  const install = vi.fn(async () => outcome);
  const run = (packages: string[]) => offerInstall({ confirm, install, say, command: 'pnpm install' }, packages);
  return { say, confirm, install, run };
}

describe('offerInstall', () => {
  it('does nothing when there is nothing to install', async () => {
    const { run, confirm } = setup(true);
    await run([]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks first, naming the packages and the command', async () => {
    const { run, confirm } = setup(false);
    await run(['three']);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('three'), INSTALL_LABEL);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('pnpm install'), INSTALL_LABEL);
  });

  it('does not install when the user declines, and says what to run', async () => {
    const { run, install, say } = setup(false);
    await run(['three']);
    expect(install).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(expect.stringContaining('pnpm install'));
  });

  it('installs when confirmed and reports it', async () => {
    const { run, install, say } = setup(true);
    await run(['three']);
    expect(install).toHaveBeenCalledOnce();
    expect(say).toHaveBeenLastCalledWith(expect.stringMatching(/Installed/));
  });

  it('reports a cancelled install', async () => {
    const { run, say } = setup(true, DepsOutcome.Cancelled);
    await run(['three']);
    expect(say).toHaveBeenLastCalledWith(expect.stringMatching(/cancel/i));
  });

  it('reports why an install failed', async () => {
    const { run, say } = setup(true, { failure: 'missing-deps', line: 'ERESOLVE could not resolve' });
    await run(['three']);
    expect(say).toHaveBeenLastCalledWith(expect.stringContaining('ERESOLVE could not resolve'));
  });
});
