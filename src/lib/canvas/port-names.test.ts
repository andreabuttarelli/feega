import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const tile = readFileSync(join(dir, '..', 'components', 'canvas', 'CanvasTile.svelte'), 'utf8');
const style = tile.slice(tile.indexOf('<style'));

function shownBy(selector: string): boolean {
  const rule = style.split('}').find((block) => block.includes(selector) && block.includes('.port-name'));
  return !!rule && /opacity:\s*1/.test(style.slice(style.indexOf(rule)));
}

describe('il nome di una porta si vede solo quando serve', () => {
  it('a riposo il nome è nascosto, la porta no', () => {
    expect(style).toMatch(/\.port-name \{[^}]*opacity: 0;/);
  });

  it('su un nodo selezionato, tranne le porte spente', () => {
    expect(shownBy('.svelte-flow__node.selected .typed-port:not(.port-off)')).toBe(true);
  });

  it('tirando un filo, sulle porte che lo accettano', () => {
    expect(shownBy('.typed-port.port-lit')).toBe(true);
  });

  it("all'hover del nodo o della porta, solo dove l'hover esiste", () => {
    const hover = style.slice(style.indexOf('@media (hover: hover)'));
    expect(hover).toContain('.svelte-flow__node:hover .typed-port.port-quiet');
    expect(hover).toContain('.typed-port:hover:not(.port-off)');
  });

  it('con il movimento ridotto la dissolvenza sparisce', () => {
    expect(style).toMatch(/prefers-reduced-motion: reduce\)[^@]*\.port-name \{\s*transition: none;/);
  });

  it('il nome resta per chi non vede: ogni porta tipizzata ha aria-label', () => {
    const ports = tile.match(/class=\{`typed-port[\s\S]*?>/g) ?? [];
    expect(ports.length).toBeGreaterThan(0);
    expect(ports.every((port) => port.includes('aria-label='))).toBe(true);
  });
});
