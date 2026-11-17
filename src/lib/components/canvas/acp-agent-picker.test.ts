import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { AcpLaunch, AgentAuth, type DetectedAgent } from '$lib/acp/detected-agent';
import { markOf } from '$lib/acp/agent-marks';
import { AGENT_CATALOG } from '$lib/server/acp/detect';
import AcpAgentPicker from './AcpAgentPicker.svelte';

const agent = (over: Partial<DetectedAgent>): DetectedAgent => ({ id: 'claude', name: 'Claude Code', installed: true, version: '2.1.3', launch: AcpLaunch.Adapter, auth: AgentAuth.SignedIn, install: 'npm i -g claude', login: 'claude /login', ...over });

const html = (agents: DetectedAgent[], chosen: string | null = null) => render(AcpAgentPicker, { props: { agents, chosen, open: true, onchoose: () => {}, onrefresh: () => {} } }).body;

const row = (body: string, id: string) => body.slice(body.indexOf(`data-agent="${id}"`), body.indexOf('</li>', body.indexOf(`data-agent="${id}"`)));

describe('the agent picker', () => {
  it('offers Feega cloud first, then each agent', () => {
    const body = html([agent({}), agent({ id: 'codex', name: 'Codex CLI' })]);

    expect(body.indexOf('Feega cloud')).toBeLessThan(body.indexOf('Claude Code'));
    expect(body.indexOf('Claude Code')).toBeLessThan(body.indexOf('Codex CLI'));
  });

  it('shows a ready agent as a tile with its mark and no version or badge', () => {
    const claude = row(html([agent({})]), 'claude');

    expect(claude).toContain('<svg');
    expect(claude).not.toContain('2.1.3');
    expect(claude).not.toContain('Ready');
    expect(claude).not.toContain('data-dot');
    expect(claude).not.toContain('disabled');
  });

  it('lists ready agents before the ones that are not installed', () => {
    const body = html([agent({ id: 'goose', name: 'Goose', installed: false, launch: AcpLaunch.None }), agent({})]);

    expect(body.indexOf('Claude Code')).toBeLessThan(body.indexOf('Goose'));
  });

  it('dims an agent that is not installed, with a tooltip and no install command', () => {
    const goose = row(html([agent({ id: 'goose', name: 'Goose', installed: false, version: null, launch: AcpLaunch.None, install: 'brew install block-goose-cli' })]), 'goose');

    expect(goose).toContain('disabled');
    expect(goose).toContain('title="Not installed"');
    expect(goose).toContain('data-dot');
    expect(goose).not.toContain('brew install');
    expect(goose).not.toContain('Copy');
  });

  it('says to sign in from the terminal when the agent needs a login', () => {
    const codex = row(html([agent({ id: 'codex', name: 'Codex CLI', auth: AgentAuth.NeedsLogin, login: 'codex login' })]), 'codex');

    expect(codex).toContain('title="Sign in from your terminal"');
    expect(codex).toContain('data-dot');
    expect(codex).not.toContain('codex login');
    expect(codex).not.toContain('Copy');
  });

  it('gives every catalogue agent a real mark', () => {
    for (const a of AGENT_CATALOG) {
      expect(markOf(a.id), a.id).not.toBeNull();
    }
  });

  it('marks the remembered choice', () => {
    expect(row(html([agent({})], 'claude'), 'claude')).toContain('aria-checked="true"');
  });
});
