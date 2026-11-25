import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MCP_COMMAND, MCP_DOCS_URL } from './onboarding-slides';

const DOCS_ORIGIN = 'https://docs.feega.app/';
const DOCS_CONTENT = fileURLToPath(new URL('../../../web-docs/src/content/docs/', import.meta.url));

describe('MCP_DOCS_URL', () => {
  it('apre la pagina docs che spiega la connessione via MCP', () => {
    expect(MCP_DOCS_URL.startsWith(DOCS_ORIGIN)).toBe(true);

    const slug = MCP_DOCS_URL.slice(DOCS_ORIGIN.length).replace(/\/$/, '');

    expect(slug).toBe('more/connect-your-agent-via-mcp');
    expect(existsSync(join(DOCS_CONTENT, `${slug}.md`))).toBe(true);
  });
});

describe('MCP_COMMAND', () => {
  it('passa -y a npx così il server stdio non si blocca sul prompt di installazione', () => {
    expect(MCP_COMMAND).toBe('claude mcp add feega -- npx -y feega mcp');
  });
});
