import { describe, expect, it } from 'vitest';
import { foldKey, isOpen, toggled } from './section-folds';

describe('section folds', () => {
  it('una sezione è aperta di default', () => {
    expect(isOpen([], foldKey('mesh', 'gradient'))).toBe(true);
  });

  it('toggle chiude una sezione aperta e la riapre', () => {
    const shut = toggled([], foldKey('mesh', 'gradient'));

    expect(isOpen(shut, foldKey('mesh', 'gradient'))).toBe(false);
    expect(isOpen(toggled(shut, foldKey('mesh', 'gradient')), foldKey('mesh', 'gradient'))).toBe(true);
  });

  it('la chiave unisce plugin e sezione: stesso id in plugin diversi sono indipendenti', () => {
    const shut = toggled([], foldKey('mesh', 'main'));

    expect(isOpen(shut, foldKey('lucide', 'main'))).toBe(true);
  });

  it('la chiave non collide tra plugin e sezione con separatori nel nome', () => {
    expect(foldKey('a/b', 'c')).not.toBe(foldKey('a', 'b/c'));
  });
});
