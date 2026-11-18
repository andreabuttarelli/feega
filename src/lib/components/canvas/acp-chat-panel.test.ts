import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import AcpChatPanel from './AcpChatPanel.svelte';
import ChatComposer from '$lib/components/brand-agent/ChatComposer.svelte';
import ChatEffortPicker from '$lib/components/brand-agent/ChatEffortPicker.svelte';

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
});

describe('the shared composer', () => {
  it('takes its placeholder from the caller', () => {
    const body = render(ChatComposer, { props: { value: '', onsend: () => {}, onstop: () => {}, placeholder: 'Ask Claude Code' } }).body;

    expect(body).toContain('placeholder="Ask Claude Code"');
  });
});

describe('the effort picker the local and cloud chats share', () => {
  const picker = (efforts: string[], value: string | null) => render(ChatEffortPicker, { props: { efforts, value, onchoose: () => {} } }).body;

  it('lists the efforts an agent offers, in words', () => {
    const body = picker(['default', 'low', 'xhigh', 'max'], 'xhigh');

    expect(body).toContain('name="reasoning"');
    for (const label of ['Default', 'Low', 'Extra high', 'Max']) {
      expect(body).toContain(`>${label}</option>`);
    }
  });

  it('is absent when the model has no effort to choose', () => {
    expect(picker([], null)).not.toContain('<select');
  });

  it('sits in the local composer next to the model picker', () => {
    expect(panel()).toContain('data-testid="acp-effort-slot"');
  });
});
