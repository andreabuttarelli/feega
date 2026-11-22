import { Composition } from "remotion";
import { ColdOpen } from "./scenes/ColdOpen";
import { COLD_OPEN_FRAMES } from "./scenes/coldOpenTimeline";
import { FPS, HEIGHT, WIDTH } from "./timing";

export const Root = () => (
  <Composition
    id="ColdOpen"
    component={ColdOpen}
    durationInFrames={COLD_OPEN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
