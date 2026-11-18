import { describe, expect, it } from 'vitest';
import { CLIENT_COPY, CliClient, appState, clientOf } from './cli-client';

describe('who is asking to sign in', () => {
  it('reads the Feega app from the state it generated', () => {
    expect(clientOf(appState('3f2a'))).toBe(CliClient.App);
  });

  it('treats any other state as the terminal CLI', () => {
    expect(clientOf('3f2a-9b1c')).toBe(CliClient.Terminal);
  });

  it('never tells an app user to go back to the terminal', () => {
    expect(Object.values(CLIENT_COPY[CliClient.App]).join(' ')).not.toMatch(/terminal|CLI/);
  });
});
