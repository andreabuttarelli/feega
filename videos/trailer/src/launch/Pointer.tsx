import { glide, mix } from "../ease";

export type Waypoint = { at: number; x: number; y: number };

export type Click = { label: string; at: number; path: Waypoint[]; rect: { x: number; y: number; w: number; h: number } };

const TIP = 2;

export const pointerAt = (frame: number, path: Waypoint[]) => {
  let x = path[0].x;
  let y = path[0].y;

  for (let i = 1; i < path.length; i++) {
    const p = glide(frame, path[i - 1].at, path[i].at - path[i - 1].at);
    x = mix(x, path[i].x, p);
    y = mix(y, path[i].y, p);
  }

  return { x, y };
};

export const Pointer = ({ x, y, pressed, scale = 1 }: { x: number; y: number; pressed: boolean; scale?: number }) => (
  <svg width={34} height={40} viewBox="0 0 17 20" style={{ position: "absolute", left: x - TIP, top: y - TIP, zIndex: 50, transform: `scale(${(pressed ? 0.86 : 1) / scale})`, transformOrigin: `${TIP}px ${TIP}px`, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.35))" }}>
    <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#fff" stroke="#000" strokeWidth={1.2} strokeLinejoin="round" />
  </svg>
);
