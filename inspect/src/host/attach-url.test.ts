import { describe, expect, it } from 'vitest';
import { n } from './test-paths';
import { appOfSource, firstStampedFile, urlOf } from './attach-url';

describe('urlOf', () => {
  it('keeps an http address, dropping path and trailing slash', () => {
    expect(urlOf('http://localhost:5173/')).toBe('http://localhost:5173');
    expect(urlOf(' https://127.0.0.1:3000/a/b?x=1 ')).toBe('https://127.0.0.1:3000');
  });

  it('adds http:// to a bare host and port', () => {
    expect(urlOf('localhost:5173')).toBe('http://localhost:5173');
  });

  it('refuses what is not a web address', () => {
    expect(urlOf('')).toBeNull();
    expect(urlOf('ftp://localhost:21')).toBeNull();
    expect(urlOf('not a url')).toBeNull();
  });
});

describe('firstStampedFile', () => {
  it('reads the file of the first stamped element', () => {
    expect(firstStampedFile('<div data-feega-src="web/src/App.tsx:3:5"><p data-feega-src="x.tsx:1:1"></p></div>')).toBe('web/src/App.tsx');
  });

  it('is null when nothing is stamped', () => {
    expect(firstStampedFile('<div></div>')).toBeNull();
  });
});

describe('appOfSource', () => {
  const apps = ['apps/web', 'apps/admin'];

  it('picks the app that holds the file, relative or absolute', () => {
    expect(appOfSource(n('/w'), apps, 'apps/admin/src/a.svelte')).toBe('apps/admin');
    expect(appOfSource(n('/w'), apps, n('/w/apps/web/src/a.svelte'))).toBe('apps/web');
  });

  it('is null when no app holds it', () => {
    expect(appOfSource(n('/w'), apps, 'other/a.svelte')).toBeNull();
  });
});
