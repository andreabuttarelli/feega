import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enabledIn, pluginsRoot, readRegistry, registryPath, setEnabled, writeRegistry, type Registry } from './registry';

const empty: Registry = { installed: {}, disabled: [] };

describe('registry', () => {
  it('is empty when nothing was ever installed', () => {
    expect(readRegistry(mkdtempSync(join(tmpdir(), 'feega-reg-')))).toEqual(empty);
  });

  it('is empty when the file is damaged', () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-reg-'));
    writeFileSync(registryPath(root), '{nope');
    expect(readRegistry(root)).toEqual(empty);
  });

  it('keeps what was written', () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-reg-'));
    const held: Registry = { installed: { 'a.b': { version: '1.0.0', source: 'x', sha256: 'f', permissions: [] } }, disabled: ['feega.mesh-gradient'] };
    writeRegistry(root, held);
    expect(readRegistry(root)).toEqual(held);
  });

  it('switches a plugin off and on, built-ins included', () => {
    const off = setEnabled(empty, 'feega.mesh-gradient', false);
    expect(enabledIn(off, 'feega.mesh-gradient')).toBe(false);
    expect(enabledIn(setEnabled(off, 'feega.mesh-gradient', true), 'feega.mesh-gradient')).toBe(true);
  });

  it('does not list a plugin twice when it is switched off twice', () => {
    expect(setEnabled(setEnabled(empty, 'a', false), 'a', false).disabled).toEqual(['a']);
  });

  it('lives in the .feega folder of the home directory', () => {
    expect(pluginsRoot('/home/ann')).toBe('/home/ann/.feega/plugins');
  });
});
