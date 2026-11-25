import { describe, expect, it } from 'vitest';
import { ToHost, WebviewUsage, type HostMessage } from '../messages';
import { Size } from './sizes';
import { breakpointOfSize, errorClassOf, watchErrors } from './usage-report';

describe('errorClassOf', () => {
  it('is the error name and never its message', () => {
    expect(errorClassOf(new TypeError('cannot read /Users/me/secret'))).toBe('TypeError');
  });

  it('falls back for anything that is not a plain error name', () => {
    expect(errorClassOf('boom /Users/me')).toBe('Error');
    expect(errorClassOf(undefined)).toBe('Error');
  });
});

describe('breakpointOfSize', () => {
  it.each([
    [Size.Full, 'base'],
    [Size.Phone, 'base'],
    [Size.Tablet, 'md'],
    [Size.TabletLandscape, 'lg'],
    [Size.Laptop, 'xl'],
    [Size.Custom, 'custom']
  ])('%s is %s', (size, expected) => {
    expect(breakpointOfSize(size)).toBe(expected);
  });
});

describe('watchErrors', () => {
  it('reports an uncaught error and a rejection by class', () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const sent: HostMessage[] = [];
    watchErrors((m) => void sent.push(m), { addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners[type] = fn) } as unknown as Window);

    listeners.error({ error: new RangeError('x') });
    listeners.unhandledrejection({ reason: new SyntaxError('y') });

    expect(sent).toEqual([
      { kind: ToHost.Usage, event: WebviewUsage.ErrorWebview, dims: { error_class: 'RangeError', area: 'webview' } },
      { kind: ToHost.Usage, event: WebviewUsage.ErrorWebview, dims: { error_class: 'SyntaxError', area: 'webview' } }
    ]);
  });
});
