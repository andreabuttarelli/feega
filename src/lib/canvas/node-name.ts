export const NODE_NAME_MAX = 60;

export function cleanNodeName(name: string): string | null {
  return name.trim().slice(0, NODE_NAME_MAX) || null;
}
