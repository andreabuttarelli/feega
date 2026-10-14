import { describe, it, expect, vi } from 'vitest';
import { ChatModelPrefs } from './chat-model-prefs.svelte';

const LISTING = { groups: [{ provider: 'z-ai', options: [] }], choice: { model: 'z-ai/glm-5.3-flash', reasoning: 'low' }, picked: true };
const UNPICKED = { ...LISTING, picked: false };

function fetcher() {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'PUT' ? { choice: JSON.parse(String(init.body)) } : LISTING)));
}

describe('chat model preference in the panel', () => {
  it('sends nothing until the listing arrives, so the server default applies', () => {
    expect(new ChatModelPrefs(fetcher()).turnFields()).toEqual({});
  });

  it('loads the saved choice and sends it with each turn', async () => {
    const prefs = new ChatModelPrefs(fetcher());
    await prefs.load();
    expect(prefs.groups).toEqual(LISTING.groups);
    expect(prefs.turnFields()).toEqual({ model: 'z-ai/glm-5.3-flash', reasoning: 'low' });
  });

  it('with no choice of the user, the turn names no model, so the server routes it', async () => {
    const prefs = new ChatModelPrefs(vi.fn(async () => new Response(JSON.stringify(UNPICKED))));
    await prefs.load();
    expect(prefs.choice).toEqual(UNPICKED.choice);
    expect(prefs.turnFields()).toEqual({});
  });

  it('a new choice applies at once and is saved for the user', async () => {
    const f = fetcher();
    const prefs = new ChatModelPrefs(f);
    await prefs.choose({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'medium' });
    expect(prefs.turnFields()).toEqual({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'medium' });
    expect(f).toHaveBeenCalledWith('/api/v1/chat-models', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'medium' }) }));
  });
});
