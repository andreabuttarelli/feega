import { describe, expect, it } from 'vitest';
import { IFRAME_SANDBOX, INERT_DOCUMENT_HEADERS } from './iframe-node';

describe('INERT_DOCUMENT_HEADERS', () => {
  it('sandboxes a document opened top-level with the canvas permissions', () => {
    expect(INERT_DOCUMENT_HEADERS['content-security-policy']).toBe(`sandbox ${IFRAME_SANDBOX}`);
    expect(INERT_DOCUMENT_HEADERS['content-security-policy']).not.toContain('allow-same-origin');
  });

  it('forbids content sniffing', () => {
    expect(INERT_DOCUMENT_HEADERS['x-content-type-options']).toBe('nosniff');
  });
});
