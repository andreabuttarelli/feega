export enum NodeChrome {
  None = 'none',
  Selected = 'selected',
  Editing = 'editing'
}

enum Level {
  None = 'none',
  Node = 'node',
  Inside = 'inside',
  Typing = 'typing'
}

export type Chrome = { ring: NodeChrome; handles: boolean };

const CHROME: Record<Level, Chrome> = {
  [Level.None]: { ring: NodeChrome.None, handles: false },
  [Level.Node]: { ring: NodeChrome.Selected, handles: true },
  [Level.Inside]: { ring: NodeChrome.Editing, handles: false },
  [Level.Typing]: { ring: NodeChrome.None, handles: false }
};

type OpenFrame = { nodeId: string; selection: readonly string[] } | null;

function levelOf(nodeId: string, selected: boolean, open: OpenFrame, typed: string | null): Level {
  if (!selected) {
    return Level.None;
  }
  if (typed === nodeId) {
    return Level.Typing;
  }
  return open?.nodeId === nodeId && open.selection.length > 0 ? Level.Inside : Level.Node;
}

export const nodeChrome = (nodeId: string, selected: boolean, open: OpenFrame, typed: string | null = null): Chrome => CHROME[levelOf(nodeId, selected, open, typed)];

export const clipChrome = (part: string | null): Chrome => CHROME[part ? Level.Inside : Level.Node];
