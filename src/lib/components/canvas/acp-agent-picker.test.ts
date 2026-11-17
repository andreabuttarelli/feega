import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { AcpLaunch, AgentAuth, type DetectedAgent } from '$lib/acp/detected-agent';
import AcpAgentPicker from './AcpAgentPicker.svelte';

const agent = (over: Partial<DetectedAgent>): DetectedAgent => ({ id: 'claude', name: 'Claude Code', installed: true, version: '2.1.3', launch: AcpLaunch.Adapter, auth: AgentAuth.SignedIn, install: 'npm i -g claude', login: 'claude /login', ...over });

const html = (agents: DetectedAgent[], chosen: string | null = null) => render(AcpAgentPicker, { props: { agents, chosen, open: true, onchoose: () => {}, onrefresh: () => {} } }).body;

const row = (body: string, id: string) => body.slice(body.indexOf(`data-agent="${id}"`), body.indexOf('</li>', body.indexOf(`data-agent="${id}"`)));

describe('the agent picker', () => {
  it('offers Feega cloud first, then each agent', () => {
    const body = html([agent({}), agent({ id: 'codex', name: 'Codex CLI' })]);

    expect(body.indexOf('Feega cloud (credits)')).toBeLessThan(body.indexOf('Claude Code'));
    expect(body.indexOf('Claude Code')).toBeLessThan(body.indexOf('Codex CLI'));
  });

  it('shows the version and a ready badge for a signed-in agent', () => {
    const claude = row(html([agent({})]), 'claude');

    expect(claude).toContain('2.1.3');
    expect(claude).toContain('Ready');
    expect(claude).not.toContain('disabled');
  });

  it('greys out an agent that is not installed and offers its install command to copy', () => {
    const goose = row(html([agent({ id: 'goose', name: 'Goose', installed: false, version: null, launch: AcpLaunch.None, install: 'brew install block-goose-cli' })]), 'goose');

    expect(goose).toContain('disabled');
    expect(goose).toContain('brew install block-goose-cli');
    expect(goose).toContain('Copy');
  });

  it('offers the login command to copy when the agent needs a login', () => {
    const codex = row(html([agent({ id: 'codex', name: 'Codex CLI', auth: AgentAuth.NeedsLogin, login: 'codex login' })]), 'codex');

    expect(codex).toContain('Needs login');
    expect(codex).toContain('codex login');
    expect(codex).toContain('Copy');
  });

  it('marks the remembered choice', () => {
    expect(row(html([agent({})], 'claude'), 'claude')).toContain('aria-checked="true"');
  });
});
