import { describe, expect, it } from 'vitest';
import { ASK_PROMPT, ASSISTANTS, askUrl } from './assistants';
import { DISMISSED_KEY, dismiss, inFrame, isDismissed } from './visibility';

const EXPECTED_ENDPOINTS: Record<string, string> = {
  ChatGPT: 'https://chatgpt.com/',
  Claude: 'https://claude.ai/new',
  Perplexity: 'https://www.perplexity.ai/search',
  Grok: 'https://grok.com/',
  Mistral: 'https://chat.mistral.ai/chat'
};

describe('assistant links', () => {
  it('each assistant opens its endpoint with the encoded prompt', () => {
    expect(ASSISTANTS.map((a) => a.name)).toEqual(Object.keys(EXPECTED_ENDPOINTS));

    for (const assistant of ASSISTANTS) {
      const url = new URL(askUrl(assistant));

      expect(`${url.origin}${url.pathname}`).toBe(EXPECTED_ENDPOINTS[assistant.name]);
      expect(url.searchParams.get('q')).toBe(ASK_PROMPT);
    }
  });

  it('the prompt points at the canonical llms.txt', () => {
    expect(ASK_PROMPT).toContain('https://www.feega.app/llms.txt');
    expect(askUrl(ASSISTANTS[0])).toContain(encodeURIComponent('https://www.feega.app/llms.txt'));
  });
});

describe('dismissal', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('is remembered after dismiss', () => {
    const storage = memory();

    expect(isDismissed(storage)).toBe(false);
    dismiss(storage);

    expect(storage.getItem(DISMISSED_KEY)).not.toBeNull();
    expect(isDismissed(storage)).toBe(true);
  });

  it('survives storage that throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };

    expect(isDismissed(broken)).toBe(false);
    expect(() => dismiss(broken)).not.toThrow();
    expect(isDismissed(null)).toBe(false);
    expect(() => dismiss(null)).not.toThrow();
  });
});

describe('preview frames', () => {
  it('detects a window embedded in another', () => {
    const top = {};

    expect(inFrame({ self: top, top })).toBe(false);
    expect(inFrame({ self: {}, top })).toBe(true);
  });
});
