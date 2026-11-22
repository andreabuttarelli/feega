import { describe, expect, it } from 'vitest';
import { lower } from './lower';

describe('lower', () => {
  it('lowercases common words, title case included', () => {
    expect(lower('Design Inside Your Code')).toBe('design inside your code');
    expect(lower("Let’s start")).toBe('let’s start');
  });

  it('keeps proper nouns, acronyms and product names', () => {
    expect(lower('Open the Feega VS Code extension for Claude Code, Codex or Cursor with AI via MCP')).toBe(
      'open the Feega VS Code extension for Claude Code, Codex or Cursor with AI via MCP'
    );
    expect(lower('Feega Cloud for GitHub and Hunyuan3D')).toBe('Feega Cloud for GitHub and Hunyuan3D');
  });

  it('keeps the competitor and agent names capitalized in headings', () => {
    expect(lower('Where Lovable Is Still The Better Choice')).toBe('where Lovable is still the better choice');
    expect(lower('Framer, Grok Build, OpenAI Codex and Cursor on GitHub with Tailwind')).toBe('Framer, Grok Build, OpenAI Codex and Cursor on GitHub with Tailwind');
  });

  it('leaves markup attributes alone', () => {
    expect(lower('See <a href="/AI-Transparency">AI Transparency</a>')).toBe('see <a href="/AI-Transparency">AI transparency</a>');
  });

  it('lowercases the pronoun I', () => {
    expect(lower('Can I run it locally?')).toBe('can i run it locally?');
  });
});
