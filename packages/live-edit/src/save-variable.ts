export enum VariableHome {
  Root = 'root',
  Theme = 'theme'
}

const BLOCKS: Record<VariableHome, { selector: RegExp; open: string; prefix: string }> = {
  [VariableHome.Root]: { selector: /(^|\n)(\s*):root\s*\{([^}]*)\}/, open: ':root', prefix: '--' },
  [VariableHome.Theme]: { selector: /(^|\n)(\s*)@theme\s*\{([^}]*)\}/, open: '@theme', prefix: '--color-' }
};

const INDENT = '  ';

export const kebab = (name: string) =>
  name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export function freeVariable(wanted: string, css: string): string {
  const base = kebab(wanted) || 'colour';
  let name = base;
  for (let n = 2; new RegExp(`--(color-)?${name}\\s*:`).test(css); n++) {
    name = `${base}-${n}`;
  }
  return name;
}

export const variableName = (name: string, home: VariableHome) => `${BLOCKS[home].prefix}${name}`;

export function saveVariable(css: string, name: string, value: string, home: VariableHome): string {
  const block = BLOCKS[home];
  const declaration = `${INDENT}${variableName(name, home)}: ${value};`;
  const found = css.match(block.selector);
  if (found) {
    const body = found[3].replace(/\s*$/, '');
    return css.replace(block.selector, `${found[1]}${found[2]}${block.open} {${body}\n${declaration}\n}`);
  }
  const rule = `${block.open} {\n${declaration}\n}\n`;
  return home === VariableHome.Root ? `${rule}\n${css}` : `${css.trimEnd()}\n\n${rule}`;
}
