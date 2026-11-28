import type { ComponentRow } from '../host/component-list';
import type { Focus } from './focus';

export const componentFocus = (row: ComponentRow): Focus => ({ name: row.name, source: { file: row.file, line: 1, col: 1 }, index: 0, usage: null, alone: true });

export const keyOfComponent = (row: ComponentRow) => `${row.file}::${row.name}`;
