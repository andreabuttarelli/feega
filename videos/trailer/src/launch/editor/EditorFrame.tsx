import type { ReactNode } from "react";
import { Place } from "../Section";
import type { Point } from "./layout";

const ENTER_SHIFT = 1200;
const ENTER_TILT = 8;

export const EditorFrame = ({ x, y, scale, enter, zoom, focus, children }: { x: number; y: number; scale: number; enter: number; zoom: number; focus: Point; children: ReactNode }) => (
  <Place x={x} y={y} style={{ transform: `translateX(${(1 - enter) * ENTER_SHIFT}px) rotate(${(1 - enter) * ENTER_TILT}deg) scale(${scale})`, transformOrigin: "0 0" }}>
    <div style={{ position: "relative", transform: `scale(${zoom})`, transformOrigin: `${focus.x}px ${focus.y}px` }}>{children}</div>
  </Place>
);
