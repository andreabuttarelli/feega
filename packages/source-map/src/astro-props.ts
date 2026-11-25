import { parse } from '@babel/parser';
import type { PropControl } from './prop-model.ts';
import { controlsOfPattern, declarationsOf, destructuredOf, type TsNode } from './ts-controls.ts';

const FRONTMATTER = /^\s*---\r?\n([\s\S]*?)\r?\n---/;
const PROPS_TYPE = 'Props';

const isAstroProps = (node: TsNode | null | undefined): boolean => node?.type === 'MemberExpression' && node.object?.name === 'Astro' && node.property?.name === 'props';

function propsPattern(body: TsNode[]): TsNode | null | undefined {
  const declarations = body.flatMap((statement) => (statement.type === 'VariableDeclaration' ? (statement.declarations as TsNode[]) : []));
  return declarations.find((declaration) => isAstroProps(declaration.init))?.id;
}

export function astroControlsOf(code: string): PropControl[] | null {
  const frontmatter = FRONTMATTER.exec(code)?.[1];
  if (frontmatter === undefined) {
    return null;
  }
  try {
    const body = parse(frontmatter, { sourceType: 'module', plugins: ['typescript'] }).program.body as TsNode[];
    const declared = declarationsOf(body);
    const pattern = propsPattern(body);
    if (!pattern && !declared.has(PROPS_TYPE)) {
      return null;
    }
    const names = pattern?.type === 'ObjectPattern' ? destructuredOf(pattern) : null;
    return controlsOfPattern(names, declared.get(PROPS_TYPE), declared);
  } catch {
    return null;
  }
}
