import { useVideoConfig } from "remotion";
import type { Point, Rect } from "./editor/layout";

export enum Format {
  Wide = "wide",
  Tall = "tall",
}

export const TALL_STAGE = { width: 1080, height: 1920 };
export const SAFE: Rect = { x: 0, y: 250, w: 1080, h: 1370 };

export const useStage = () => {
  const { width, height } = useVideoConfig();

  return { width, height, format: height > width ? Format.Tall : Format.Wide };
};

export type Camera = { x: number; y: number; scale: number };

export type TallClick = { label: string; at: number; target: Rect; view: Rect };

export const rectOnScreen = (r: Rect, cam: Camera): Rect => ({ x: cam.x + r.x * cam.scale, y: cam.y + r.y * cam.scale, w: r.w * cam.scale, h: r.h * cam.scale });

export const within = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const readable = (click: TallClick) => {
  const centre = { x: click.target.x + click.target.w / 2, y: click.target.y + click.target.h / 2 };

  return within(centre, click.view) && within(centre, SAFE);
};
