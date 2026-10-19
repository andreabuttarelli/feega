export enum HoverProbe {
  Probe = 'probe',
  Clear = 'clear'
}

const NO_BUTTONS = 0;

export const hoverProbe = (e: { pointerType: string; buttons: number }): HoverProbe => (e.pointerType === 'mouse' && e.buttons === NO_BUTTONS ? HoverProbe.Probe : HoverProbe.Clear);

export function moveGate(): (x: number, y: number, under: object) => boolean {
  let last: { x: number; y: number; under: object } | null = null;
  return (x, y, under) => {
    if (last && last.x === x && last.y === y && last.under === under) {
      return false;
    }
    last = { x, y, under };
    return true;
  };
}
