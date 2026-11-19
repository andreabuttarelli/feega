import { describe, expect, it } from 'vitest';
import { hmrSocketUrl, changesPage } from './dev-hmr';

describe('hmrSocketUrl', () => {
  it('porta il token del client Vite sul websocket, che senza viene rifiutato', () => {
    expect(hmrSocketUrl('http://localhost:5288/', 'const wsToken = "abc123";')).toBe('ws://localhost:5288/?token=abc123');
  });

  it('senza token apre il websocket nudo', () => {
    expect(hmrSocketUrl('https://localhost:5288', 'export {}')).toBe('wss://localhost:5288/');
  });
});

describe('changesPage', () => {
  it('un update o un reload cambiano la pagina, il resto no', () => {
    expect(changesPage('{"type":"update","updates":[]}')).toBe(true);
    expect(changesPage('{"type":"full-reload"}')).toBe(true);
    expect(changesPage('{"type":"connected"}')).toBe(false);
    expect(changesPage('not json')).toBe(false);
  });
});
