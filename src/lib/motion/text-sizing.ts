export enum TextSizing {
  Fixed = 'fixed',
  AutoWidth = 'auto',
  AutoHeight = 'auto-height'
}

export const TEXT_SIZINGS = [TextSizing.AutoWidth, TextSizing.AutoHeight, TextSizing.Fixed] as const;

type Placement = { x: number; y: number; width: number; height: number };
type PxBox = { left: number; top: number; width: number; height: number };
type Stage = { width: number; height: number };

const SLACK_PX = 0.5;

const FOLLOWS: Record<TextSizing, { width: boolean; height: boolean }> = {
  [TextSizing.Fixed]: { width: false, height: false },
  [TextSizing.AutoWidth]: { width: true, height: true },
  [TextSizing.AutoHeight]: { width: false, height: true }
};

export function fittedTextBox(sizing: TextSizing, placed: Placement, measured: PxBox, stage: Stage): Placement | null {
  const follows = FOLLOWS[sizing];
  const width = follows.width ? measured.width : placed.width * stage.width;
  const height = follows.height ? measured.height : placed.height * stage.height;
  const same = Math.abs(width - placed.width * stage.width) <= SLACK_PX && Math.abs(height - placed.height * stage.height) <= SLACK_PX;
  if (same) {
    return null;
  }

  const left = (placed.x - placed.width / 2) * stage.width;
  const top = (placed.y - placed.height / 2) * stage.height;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x: round((left + width / 2) / stage.width), y: round((top + height / 2) / stage.height), width: round(width / stage.width), height: round(height / stage.height) };
}

export function sizingAfterResize(sizing: TextSizing, changed: { width: boolean; height: boolean }): TextSizing {
  if (changed.height) {
    return TextSizing.Fixed;
  }
  return changed.width && sizing === TextSizing.AutoWidth ? TextSizing.AutoHeight : sizing;
}
