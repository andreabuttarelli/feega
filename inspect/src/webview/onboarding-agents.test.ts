import { describe, expect, it } from 'vitest';
import { AcpId, type AcpAgent } from '../host/ai/acp-agents';
import { Detection, overviewOf } from './onboarding-agents';

const agent = (id: AcpId, label: string, installed: boolean): AcpAgent => ({ id, label, installed, install: '', adapter: false });

describe('onboarding agents overview', () => {
  it('lists detected agents before the ones not found', () => {
    const { rows } = overviewOf([agent(AcpId.Goose, 'Goose', false), agent(AcpId.Claude, 'Claude Code', true)]);

    expect(rows.map((row) => [row.label, row.state])).toEqual([
      ['Claude Code', Detection.Detected],
      ['Goose', Detection.NotFound]
    ]);
  });

  it('keeps the chat picker order inside each group', () => {
    const { rows } = overviewOf([agent(AcpId.Codex, 'Codex', true), agent(AcpId.Claude, 'Claude Code', true)]);

    expect(rows.map((row) => row.id)).toEqual([AcpId.Codex, AcpId.Claude]);
  });

  it('gives a known agent its logo and an unknown one an initial', () => {
    const { rows } = overviewOf([agent(AcpId.Claude, 'Claude Code', true), agent(AcpId.Vibe, 'Mistral Vibe', true)]);

    expect(rows[0].mark.logo).not.toBeNull();
    expect(rows[1].mark.logo).not.toBeNull();
    expect(overviewOf([agent('mystery' as AcpId, 'Mystery', true)]).rows[0].mark).toEqual({ logo: null, initial: 'M' });
  });

  it('is empty when nothing is detected', () => {
    expect(overviewOf([agent(AcpId.Claude, 'Claude Code', false)]).none).toBe(true);
    expect(overviewOf([agent(AcpId.Claude, 'Claude Code', true)]).none).toBe(false);
  });
});
