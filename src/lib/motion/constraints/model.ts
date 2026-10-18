import { z } from 'zod';

export enum Horizontal {
  Left = 'left',
  Right = 'right',
  LeftRight = 'left_right',
  Center = 'center',
  Scale = 'scale'
}

export enum Vertical {
  Top = 'top',
  Bottom = 'bottom',
  TopBottom = 'top_bottom',
  Center = 'center',
  Scale = 'scale'
}

export const HORIZONTALS = Object.values(Horizontal) as [Horizontal, ...Horizontal[]];
export const VERTICALS = Object.values(Vertical) as [Vertical, ...Vertical[]];

export const constraintsSchema = z.object({
  horizontal: z.enum(HORIZONTALS).default(Horizontal.Scale),
  vertical: z.enum(VERTICALS).default(Vertical.Scale)
});

export type Constraints = z.infer<typeof constraintsSchema>;
