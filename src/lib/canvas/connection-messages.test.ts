import { describe, expect, it } from 'vitest';
import { CONNECTION_MESSAGE, ConnectionError, connectionMessage } from './connection-messages';

describe('what a connection failure tells the person', () => {
  it('has a sentence for every error kind, none of them the raw code', () => {
    for (const kind of Object.values(ConnectionError)) {
      expect(CONNECTION_MESSAGE[kind]).toMatch(/\s/);
      expect(CONNECTION_MESSAGE[kind]).not.toContain('_');
    }
  });

  it('turns a server code into its sentence', () => {
    expect(connectionMessage('token_rejected')).toBe(CONNECTION_MESSAGE[ConnectionError.TokenRejected]);
    expect(connectionMessage('download_failed')).toBe(CONNECTION_MESSAGE[ConnectionError.DownloadFailed]);
  });

  it('falls back to the given kind for a code it does not know, or none', () => {
    expect(connectionMessage('weird_code', ConnectionError.UploadFailed)).toBe(CONNECTION_MESSAGE[ConnectionError.UploadFailed]);
    expect(connectionMessage(undefined, ConnectionError.DownloadFailed)).toBe(CONNECTION_MESSAGE[ConnectionError.DownloadFailed]);
  });
});
