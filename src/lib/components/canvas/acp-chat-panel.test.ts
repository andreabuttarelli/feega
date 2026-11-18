import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import AcpChatPanel from './AcpChatPanel.svelte';
import ChatComposer from '$lib/components/brand-agent/ChatComposer.svelte';

const panel = () => render(AcpChatPanel).body;

describe('the local chat composer', () => {
  it('is the cloud composer: icon send button, no text Send button', () => {
    const body = panel();

    expect(body).toContain('aria-label="Send"');
    expect(body).toContain('class="act send');
    expect(body).not.toMatch(/>\s*Send\s*<\/button>/);
  });

  it('leaves a slot where a model picker plugs in', () => {
    expect(panel()).toContain('data-testid="acp-model-slot"');
  });

  it('shows no cloud model menu', () => {
    expect(panel()).not.toContain('chat-model-picker');
  });

  it('asks for an agent first when none is chosen', () => {
    expect(panel()).toContain('placeholder="Pick an agent first"');
  });

  it('promises no cloud credits: the chat runs on the agent you pick', () => {
    expect(panel()).not.toMatch(/spends credits/i);
    expect(panel()).toContain('no feega credits');
  });
});

describe('the shared composer', () => {
  it('takes its placeholder from the caller', () => {
    const body = render(ChatComposer, { props: { value: '', onsend: () => {}, onstop: () => {}, placeholder: 'Ask Claude Code' } }).body;

    expect(body).toContain('placeholder="Ask Claude Code"');
  });
});
