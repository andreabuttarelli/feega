import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PropKind, controlsOf } from './component-props.ts';

const BUTTON = `
type Props = { variant?: 'primary' | 'ghost'; size: 'sm' | 'md' | 'lg'; disabled?: boolean; label: string; count?: number; children?: React.ReactNode; onClick?: () => void; style?: object };
export function Button({ variant = 'primary', size, disabled = false, label, children }: Props) {
  return <button>{children}</button>;
}
export const Badge = ({ tone }: { tone: 'info' | 'warn' }) => <b>{tone}</b>;
`;

const kinds = (code: string, name: string, file = 'Button.tsx') => Object.fromEntries((controlsOf(code, file, name) ?? []).map((c) => [c.name, c.kind]));

describe('controlsOf', () => {
  it('turns a union of literals into a select with its options', () => {
    const size = controlsOf(BUTTON, 'Button.tsx', 'Button')!.find((c) => c.name === 'size');

    expect(size).toMatchObject({ kind: PropKind.Select, options: ['sm', 'md', 'lg'], required: true });
  });

  it('maps boolean, string, number and children to a toggle, text, number and children', () => {
    expect(kinds(BUTTON, 'Button')).toMatchObject({ disabled: PropKind.Toggle, label: PropKind.Text, count: PropKind.Number, children: PropKind.Children });
  });

  it('keeps the default value declared in the destructuring', () => {
    const controls = controlsOf(BUTTON, 'Button.tsx', 'Button')!;

    expect(controls.find((c) => c.name === 'variant')!.default).toBe('primary');
    expect(controls.find((c) => c.name === 'disabled')!.default).toBe(false);
  });

  it('shows callbacks and objects with their own kinds', () => {
    expect(kinds(BUTTON, 'Button')).toMatchObject({ onClick: PropKind.Callback, style: PropKind.Object });
  });

  it('keeps array and object defaults', () => {
    const code = "export function List({ items = ['a', 'b'], theme = { gap: 2 }, rows = [] }) { return <ul/>; }";
    const controls = controlsOf(code, 'List.jsx', 'List')!;

    expect(controls).toEqual([
      { name: 'items', kind: PropKind.Array, required: false, default: ['a', 'b'] },
      { name: 'theme', kind: PropKind.Object, required: false, default: { gap: 2 } },
      { name: 'rows', kind: PropKind.Array, required: false, default: [] }
    ]);
  });

  it('reads PropTypes arrays, objects and functions', () => {
    const code = "import PropTypes from 'prop-types';\nexport function Menu({ items, theme, onPick }) { return <p/>; }\nMenu.propTypes = { items: PropTypes.arrayOf(PropTypes.string), theme: PropTypes.shape({ a: PropTypes.string }), onPick: PropTypes.func };";

    expect(kinds(code, 'Menu', 'Menu.jsx')).toEqual({ items: PropKind.Array, theme: PropKind.Object, onPick: PropKind.Callback });
  });

  it('finds the component by name among several in the file', () => {
    expect(kinds(BUTTON, 'Badge')).toEqual({ tone: PropKind.Select });
  });

  it('falls back to the default export when the name matches nothing', () => {
    const code = 'export default function Card({ title = "a" }) { return <h2>{title}</h2>; }';

    expect(kinds(code, 'Whatever', 'Card.jsx')).toEqual({ title: PropKind.Text });
  });

  it('infers the control from the default value of an untyped prop', () => {
    const code = "export function Tag({ label = 'x', dense = false, level = 2 }) { return <i>{label}</i>; }";

    expect(kinds(code, 'Tag', 'Tag.jsx')).toEqual({ label: PropKind.Text, dense: PropKind.Toggle, level: PropKind.Number });
  });

  it('reads PropTypes enums and bools in plain JavaScript', () => {
    const code = "import PropTypes from 'prop-types';\nexport function Alert({ level, closable }) { return <p/>; }\nAlert.propTypes = { level: PropTypes.oneOf(['info', 'error']), closable: PropTypes.bool };";
    const level = controlsOf(code, 'Alert.jsx', 'Alert')!.find((c) => c.name === 'level');

    expect(level).toMatchObject({ kind: PropKind.Select, options: ['info', 'error'] });
    expect(kinds(code, 'Alert', 'Alert.jsx').closable).toBe(PropKind.Toggle);
  });

  it('follows a props type imported from a sibling file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-props-'));
    writeFileSync(join(dir, 'types.ts'), "export type Props = { tone: 'a' | 'b'; wide?: boolean };");
    const file = join(dir, 'Box.tsx');
    const code = "import type { Props } from './types';\nexport function Box({ tone, wide }: Props) { return <div/>; }";

    expect(kinds(code, 'Box', file)).toEqual({ tone: PropKind.Select, wide: PropKind.Toggle });
  });

  it('returns null for a file with no component', () => {
    expect(controlsOf('export const a = 1;', 'a.ts', 'a')).toBeNull();
  });

  it('returns null for source it cannot parse', () => {
    expect(controlsOf('export function ( {', 'x.tsx', 'x')).toBeNull();
  });
});
