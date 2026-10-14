export enum NodeChrome {
  None = 'none',
  Selected = 'selected',
  Editing = 'editing'
}

enum Level {
  None = 'none',
  Node = 'node',
  Inside = 'inside'
}

export type Chrome = { ring: NodeChrome; handles: boolean };

const CHROME: Record<Level, Chrome> = {
  [Level.None]: { ring: NodeChrome.None, handles: false },
  [Level.Node]: { ring: NodeChrome.Selected, handles: true },
  [Level.Inside]: { ring: NodeChrome.Editing, handles: false }
};

type OpenFrame = { nodeId: string; selection: readonly string[] } | null;

function levelOf(nodeId: string, selected: boolean, open: OpenFrame): Level {
  if (!selected) {
    return Level.None;
  }
  return open?.nodeId === nodeId && open.selection.length > 0 ? Level.Inside : Level.Node;
}

export const nodeChrome = (nodeId: string, selected: boolean, open: OpenFrame): Chrome => CHROME[levelOf(nodeId, selected, open)];

export const clipChrome = (part: string | null): Chrome => CHROME[part ? Level.Inside : Level.Node];
