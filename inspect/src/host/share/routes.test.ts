import { describe, expect, it } from 'vitest';
import { Target, targetOfRequest, targetOfSocket } from './routes';

const get = (path: string, dest?: string) => targetOfRequest({ method: 'GET', path, headers: dest ? { 'sec-fetch-dest': dest } : {} });

describe('routes', () => {
  it('serves the editor page at / when it is a top level navigation', () => {
    expect(get('/', 'document')).toBe(Target.Editor);
    expect(get('/')).toBe(Target.Editor);
    expect(get('/?x=1', 'document')).toBe(Target.Editor);
  });

  it('serves the app at / when the editor frames it', () => {
    expect(get('/', 'iframe')).toBe(Target.App);
    expect(get('/?x=1', 'iframe')).toBe(Target.App);
  });

  it('serves the editor assets itself', () => {
    expect(get('/panel.js', 'script')).toBe(Target.Editor);
    expect(get('/panel.css', 'style')).toBe(Target.Editor);
    expect(get('/panel.js?v=3', 'script')).toBe(Target.Editor);
  });

  it('leaves everything else to the app', () => {
    expect(get('/about', 'document')).toBe(Target.App);
    expect(get('/_app/immutable/x.js', 'script')).toBe(Target.App);
    expect(get('/__feega/bridge.js', 'script')).toBe(Target.App);
  });

  it('sends only the editor channel socket to the editor', () => {
    expect(targetOfSocket('/feega-host')).toBe(Target.Editor);
    expect(targetOfSocket('/?token=abc')).toBe(Target.App);
    expect(targetOfSocket('/_next/webpack-hmr')).toBe(Target.App);
  });
});
