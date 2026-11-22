import { describe, expect, it } from 'vitest';
import { CLIENT_COPY, CliClient, appState, clientOf, desktopState } from './cli-client';

describe('who is asking to sign in', () => {
  it('reads the Feega app from the state it generated', () => {
    expect(clientOf(appState('3f2a'))).toBe(CliClient.App);
  });

  it('reads the Feega desktop app from its own state', () => {
    expect(clientOf(desktopState('3f2a'))).toBe(CliClient.Desktop);
  });

  it('treats any other state as the terminal CLI', () => {
    expect(clientOf('3f2a-9b1c')).toBe(CliClient.Terminal);
  });

  it('never tells an app user to go back to the terminal', () => {
    expect(Object.values(CLIENT_COPY[CliClient.App]).join(' ')).not.toMatch(/terminal|CLI/);
  });

  it('never tells a desktop user to go back to the editor', () => {
    expect(Object.values(CLIENT_COPY[CliClient.Desktop]).join(' ')).not.toMatch(/terminal|CLI|editor/i);
  });

  it('tells a blocked browser how to allow local network access', () => {
    expect(CLIENT_COPY[CliClient.App].unreachable).toMatch(/local network access/);
    expect(CLIENT_COPY[CliClient.Desktop].unreachable).toMatch(/local network access/);
  });
});
