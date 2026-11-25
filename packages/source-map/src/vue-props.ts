import { PropKind, type PropControl, type PropValue } from './prop-model.ts';
import { controlsOfMembers, declarationsOf, literalOf, membersOf, type TsNode } from './ts-controls.ts';

export type VueCompiler = { parse: (code: string, options: { filename: string }) => { descriptor: { scriptSetup: { content: string } | null } }; babelParse: (code: string, options: object) => { program: { body: TsNode[] } } };

const CONSTRUCTORS: Record<string, PropKind> = { String: PropKind.Text, Number: PropKind.Number, Boolean: PropKind.Toggle };

function definePropsCall(body: TsNode[]): { call: TsNode; defaults: TsNode | null } | null {
  const calls: TsNode[] = [];
  const visit = (node: TsNode | null | undefined) => {
    if (node?.type === 'VariableDeclaration') {
      node.declarations.forEach((declaration: TsNode) => visit(declaration.init));
    }
    if (node?.type === 'ExpressionStatement') {
      visit(node.expression);
    }
    if (node?.type === 'CallExpression') {
      calls.push(node);
    }
  };
  body.forEach(visit);
  const wrapped = calls.find((call) => call.callee?.name === 'withDefaults');
  const direct = wrapped?.arguments[0] ?? calls.find((call) => call.callee?.name === 'defineProps');
  return direct?.callee?.name === 'defineProps' ? { call: direct, defaults: wrapped?.arguments[1] ?? null } : null;
}

function defaultsOf(node: TsNode | null): Map<string, PropValue> {
  const found = new Map<string, PropValue>();
  for (const property of node?.type === 'ObjectExpression' ? (node.properties as TsNode[]) : []) {
    const value = literalOf(property.value);
    if (property.key && value !== undefined) {
      found.set(property.key.name ?? property.key.value, value);
    }
  }
  return found;
}

function runtimeControls(argument: TsNode): PropControl[] {
  if (argument.type === 'ArrayExpression') {
    return (argument.elements as TsNode[]).map((element) => ({ name: element.value, kind: PropKind.Text, required: false }));
  }
  return (argument.properties as TsNode[]).flatMap((property) => {
    const name = property.key?.name ?? property.key?.value;
    const options = property.value.type === 'ObjectExpression' ? (property.value.properties as TsNode[]) : [];
    const declared = (key: string) => options.find((option) => option.key?.name === key)?.value;
    const kind = CONSTRUCTORS[(options.length ? declared('type') : property.value)?.name];
    const fallback = literalOf(declared('default'));
    return kind ? [{ name, kind, required: declared('required')?.value === true, ...(fallback !== undefined && { default: fallback }) }] : [];
  });
}

export function vueControlsOf(code: string, filename: string, compiler: VueCompiler): PropControl[] | null {
  try {
    const content = compiler.parse(code, { filename }).descriptor.scriptSetup?.content;
    const body = content ? compiler.babelParse(content, { sourceType: 'module', plugins: ['typescript'] }).program.body : [];
    const found = definePropsCall(body);
    if (!found) {
      return null;
    }
    const argument = found.call.arguments[0];
    if (argument) {
      return runtimeControls(argument);
    }
    const declared = declarationsOf(body);
    const members = membersOf(found.call.typeParameters?.params[0], declared);
    return controlsOfMembers(members, defaultsOf(found.defaults), declared);
  } catch {
    return null;
  }
}

