export enum PluginAction {
  Add = 'add',
  Remove = 'remove',
  List = 'list',
  Dev = 'dev'
}

export const PLUGIN_COMMAND = 'plugin';

const VALUE_NAME: Record<PluginAction, string | null> = {
  [PluginAction.Add]: 'source',
  [PluginAction.Remove]: 'plugin id',
  [PluginAction.Dev]: 'path',
  [PluginAction.List]: null
};

const ACTIONS = new Set<string>(Object.values(PluginAction));

export type PluginArgs = { action: PluginAction; value: string; rest: string[] } | { error: string };

export function pluginArgsOf(argv: string[]): PluginArgs {
  const [action, value = '', ...rest] = argv;
  if (!ACTIONS.has(action)) {
    return { error: 'plugin needs one of: add <source>, remove <id>, list, dev <path>' };
  }
  const known = action as PluginAction;
  const name = VALUE_NAME[known];
  return name && value === '' ? { error: `plugin ${known} needs a ${name}` } : { action: known, value, rest };
}
