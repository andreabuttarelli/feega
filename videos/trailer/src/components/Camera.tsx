import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { glide, mix } from "../ease";
import { CAMERA_MOVE, HEIGHT, WIDTH } from "../timing";

export type Shot = { x: number; y: number; scale: number };

type Key<F extends string> = { at: number; focus: F };

type Props<F extends string> = {
  keys: Key<F>[];
  shots: Record<F, Shot>;
  children: ReactNode;
};

const current = <F extends string>(keys: Key<F>[], frame: number) => {
  let index = 0;

  for (let i = 0; i < keys.length; i++) {
    if (keys[i].at > frame) {
      break;
    }
    index = i;
  }

  return index;
};

export const Camera = <F extends string>({ keys, shots, children }: Props<F>) => {
  const frame = useCurrentFrame();
  const index = current(keys, frame);
  const to = shots[keys[index].focus];
  const from = shots[keys[Math.max(0, index - 1)].focus];
  const t = glide(frame, keys[index].at, CAMERA_MOVE);

  const x = mix(from.x, to.x, t);
  const y = mix(from.y, to.y, t);
  const scale = Math.exp(mix(Math.log(from.scale), Math.log(to.scale), t));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: WIDTH,
          height: HEIGHT,
          transformOrigin: "0 0",
          transform: `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) scale(${scale}) translate(${-x}px, ${-y}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
