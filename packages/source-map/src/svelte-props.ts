import type { PropControl, PropValue } from './component-props.ts';
import { controlsOfMembers, declarationsOf, literalOf, membersOf, type PropMember, type TsNode } from './ts-controls.ts';

export type SvelteCompiler = { parse: (code: string, options: { modern: true }) => { instance: { content: { body: TsNode[] } } | null } };

const PROPS_RUNE = '$props';

function propsDeclaration(body: TsNode[]): TsNode | null {
  const declaration = body.find((statement) => statement.type === 'VariableDeclaration' && statement.declarations[0]?.init?.callee?.name === PROPS_RUNE);
  return declaration?.declarations[0] ?? null;
}

function destructured(pattern: TsNode): { name: string; fallback: PropValue | undefined }[] {
  return (pattern.properties as TsNode[]).flatMap((property) => {
    if (property.type !== 'Property' || !property.key?.name) {
      return [];
    }
    const withDefault = property.value.type === 'AssignmentPattern';
    return [{ name: property.key.name, fallback: withDefault ? literalOf(property.value.right) : undefined }];
  });
}

export function svelteControlsOf(code: string, compiler: SvelteCompiler): PropControl[] | null {
  try {
    const body = compiler.parse(code, { modern: true }).instance?.content.body ?? [];
    const declaration = propsDeclaration(body);
    if (!declaration || declaration.id.type !== 'ObjectPattern') {
      return null;
    }
    const names = destructured(declaration.id);
    const typed = membersOf(declaration.id.typeAnnotation?.typeAnnotation, declarationsOf(body));
    const byName = new Map(typed.map((member) => [member.name, member]));
    const members: PropMember[] = names.map(({ name }) => byName.get(name) ?? { name, optional: false, type: null });
    const defaults = new Map(names.flatMap(({ name, fallback }) => (fallback === undefined ? [] : [[name, fallback] as [string, PropValue]])));
    return controlsOfMembers(members, defaults);
  } catch {
    return null;
  }
}
