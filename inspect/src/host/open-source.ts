import { isAbsolute, join } from 'node:path';
import type { Source } from '../messages';

export enum Column {
  First = 'first',
  Beside = 'beside'
}

const FIRST_COLUMN = 1;

export type OpenTarget = { path: string; line: number; col: number; column: Column };

export function openTarget(root: string, at: Source, panelColumn: number | undefined): OpenTarget {
  return {
    path: isAbsolute(at.file) ? at.file : join(root, at.file),
    line: Math.max(0, at.line - 1),
    col: Math.max(0, at.col - 1),
    column: panelColumn === FIRST_COLUMN ? Column.Beside : Column.First
  };
}

export const revealColumn = (panelColumn: number | undefined, columns: number[]): number | null => columns.find((column) => column !== panelColumn) ?? null;
