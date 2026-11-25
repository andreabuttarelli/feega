import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { Gate, ToHost, ToView, type EditAsk } from '../messages';
import { SettingKey } from '../settings';
import { applyMessage, heldOf, muteMessage, summaryOf } from './preview-gate';

const ask: EditAsk = { at: 'src/Hero.tsx:4:10', prop: LiveProp.Color, value: 'blue' };
const files = [{ path: 'src/Hero.css', line: 2, removed: ['  color: red;'], added: ['  color: blue;'] }];

describe('preview gate', () => {
  it('la risposta dell host diventa l anteprima da mostrare', () => {
    expect(heldOf({ kind: ToView.Preview, ask, reason: 'a CSS variable can reach other elements', files })).toEqual({ ask, reason: 'a CSS variable can reach other elements', files });
  });

  it('un edit di un ospite dice chi lo chiede', () => {
    expect(heldOf({ kind: ToView.Preview, ask, reason: 'x', files, by: { userId: 'ada', name: 'Ada' } }).by).toBe('Ada');
  });

  it('Apply rimanda lo stesso edit saltando il controllo', () => {
    expect(applyMessage({ ask, reason: '', files })).toEqual({ kind: ToHost.Edit, ask, gate: Gate.Apply });
  });

  it('Apply su props rimanda la stessa scrittura saltando il controllo', () => {
    const props = { component: 'src/Card.tsx', usage: 'src/Home.tsx:4:3', set: { title: 'New' }, remove: [] };

    expect(applyMessage(heldOf({ kind: ToView.PropsPreview, ask: props, reason: 'x', files }))).toEqual({ kind: ToHost.ApplyProps, ask: props, gate: Gate.Apply });
  });

  it('Non chiedere piu spegne l anteprima', () => {
    expect(muteMessage()).toEqual({ kind: ToHost.Setting, key: SettingKey.PreviewUnknown, value: false });
  });

  it('il riepilogo dice quali file cambiano', () => {
    expect(summaryOf(files)).toBe('src/Hero.css:2');
    expect(summaryOf([...files, { path: 'a.tsx', line: 1, removed: [], added: ['x'] }])).toBe('src/Hero.css:2, a.tsx:1');
  });
});
