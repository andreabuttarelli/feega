import type { PropControl } from './prop-model.ts';
import { controlsOfPattern, declarationsOf, destructuredOf, type TsNode } from './ts-controls.ts';

export type SvelteCompiler = { parse: (code: string, options: { modern: true }) => { instance: { content: { body: TsNode[] } } | null } };

const PROPS_RUNE = '$props';

function propsDeclaration(body: TsNode[]): TsNode | null {
  const declaration = body.find((statement) => statement.type === 'VariableDeclaration' && statement.declarations[0]?.init?.callee?.name === PROPS_RUNE);
  return declaration?.declarations[0] ?? null;
}

export function svelteControlsOf(code: string, compiler: SvelteCompiler): PropControl[] | null {
  try {
    const body = compiler.parse(code, { modern: true }).instance?.content.body ?? [];
    const declaration = propsDeclaration(body);
    if (!declaration || declaration.id.type !== 'ObjectPattern') {
      return null;
    }
    return controlsOfPattern(destructuredOf(declaration.id), declaration.id.typeAnnotation?.typeAnnotation, declarationsOf(body));
  } catch {
    return null;
  }
}
