type Point = { x: number; y: number };

export type CommentPlacement = { nodeId: string | null; x: number; y: number };

export function commentPlacement(click: Point, under: (Point & { id: string }) | null): CommentPlacement {
  if (!under) {
    return { nodeId: null, x: click.x, y: click.y };
  }

  return { nodeId: under.id, x: click.x - under.x, y: click.y - under.y };
}
