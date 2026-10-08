// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('embed liquid glass, link', () => {
  it('apre bottone e link in una nuova tab, non dentro l\'iframe dell\'embed', () => {
    window.matchMedia = (() => ({ matches: false })) as never;
    document.body.innerHTML = '<feega-liquid-glass><h1>Hi</h1><a class="lg-cta" href="https://oh.feega.app/login">Start</a><a class="lg-link" href="https://feega.app#mcp">Agents</a></feega-liquid-glass>';
    window.eval(readFileSync('static/embed/liquid-glass.js', 'utf8'));

    const links = [...document.querySelectorAll('a')];

    expect(links.map((a) => a.target)).toEqual(['_blank', '_blank']);
    expect(links.every((a) => a.rel.includes('noopener'))).toBe(true);
  });
});
