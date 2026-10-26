import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_FAMILY, CORE_FACES } from './core-font';

const appCss = readFileSync('src/app.css', 'utf8');
const interfaceFamily = /--sans:\s*"([^"]+)"/.exec(appCss)![1];
const faceRules = [...appCss.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  family: /font-family:\s*'([^']+)'/.exec(body)?.[1],
  weight: Number(/font-weight:\s*(\d+)/.exec(body)?.[1]),
  url: /url\('([^']+)'\)/.exec(body)?.[1]
}));

describe('core text face', () => {
  it('is the interface font, so a card reads the same drawn by the core or by the DOM', () => {
    expect(CORE_FAMILY).toBe(interfaceFamily);
  });

  it('loads the files the interface declares for each weight it draws', () => {
    for (const face of CORE_FACES) {
      expect(faceRules).toContainEqual({ family: CORE_FAMILY, weight: face.weight, url: face.url });
    }
  });
});
