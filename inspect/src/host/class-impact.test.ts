import { describe, expect, it } from 'vitest';
import { ClassScope } from '@feega/live-edit/class-index';
import { ImpactKind, type ClassInfo } from '../messages';
import { classImpactOf, holdReason } from './impact';

const info = (elements: number, files: string[]): ClassInfo => ({ key: 'card', name: 'card', scope: ClassScope.Global, sheet: 'a.css', rules: [], uses: files.map((file, line) => ({ file, line, col: 1, dynamic: false })), home: null, elements, files: new Set(files).size });

describe('classImpactOf', () => {
  it('describes the elements and files of the class', () => {
    expect(classImpactOf(info(3, ['a.html', 'a.html', 'b.html']))).toEqual({ kind: ImpactKind.Class, name: 'card', elements: 3, files: [{ file: 'a.html', line: 0 }, { file: 'b.html', line: 2 }] });
  });

  it('is unknown when the class is not in the index', () => {
    expect(classImpactOf(undefined)).toMatchObject({ kind: ImpactKind.Unknown });
  });
});

describe('holdReason', () => {
  it('holds a class used in more than one element', () => {
    expect(holdReason(classImpactOf(info(3, ['a.html', 'b.html'])))).toBe('.card is used in 3 elements, 2 files');
  });

  it('lets a class used once through', () => {
    expect(holdReason(classImpactOf(info(1, ['a.html'])))).toBeNull();
  });

  it('keeps the unknown reason and lets local and component through', () => {
    expect(holdReason({ kind: ImpactKind.Unknown, reason: 'x' })).toBe('x');
    expect(holdReason({ kind: ImpactKind.Local })).toBeNull();
    expect(holdReason({ kind: ImpactKind.Component, name: 'A', files: [] })).toBeNull();
  });
});
