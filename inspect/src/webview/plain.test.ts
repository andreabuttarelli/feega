import { describe, expect, it } from 'vitest';
import { ToHost, type HostMessage, type Source } from '../messages';
import { plain } from './plain';

const reactive = (source: Source) => new Proxy(source, {});

describe('a message posted to the editor', () => {
  const message: HostMessage = { kind: ToHost.Selected, at: reactive({ file: 'src/App.svelte', line: 4, col: 2 }) };

  it('is rejected by the webview channel while it carries reactive state', () => {
    expect(() => structuredClone(message)).toThrow();
  });

  it('is accepted once made plain, and keeps its content', () => {
    expect(structuredClone(plain(message))).toEqual({ kind: ToHost.Selected, at: { file: 'src/App.svelte', line: 4, col: 2 } });
  });
});
