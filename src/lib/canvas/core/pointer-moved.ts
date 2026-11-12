type Spot = { x: number; y: number };

export function pointerMoves(): (at: Spot) => boolean {
  let last: Spot | null = null;
  return (at) => {
    const moved = !last || last.x !== at.x || last.y !== at.y;
    last = at;
    return moved;
  };
}
