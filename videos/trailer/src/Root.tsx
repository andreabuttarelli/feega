import { Composition, Series } from "remotion";
import { ColdOpen } from "./scenes/ColdOpen";
import { COLD_OPEN_FRAMES } from "./scenes/coldOpenTimeline";
import { Intro, INTRO_FRAMES } from "./scenes/Intro";
import { LAUNCH_FRAMES, Launch } from "./launch/Launch";
import { EditorStill, STILL } from "./launch/EditorStill";
import { TALL_STAGE } from "./launch/stage";
import { FPS, HEIGHT, WIDTH } from "./timing";

const Trailer = () => (
  <Series>
    <Series.Sequence durationInFrames={INTRO_FRAMES}>
      <Intro />
    </Series.Sequence>
    <Series.Sequence durationInFrames={COLD_OPEN_FRAMES}>
      <ColdOpen />
    </Series.Sequence>
  </Series>
);

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} durationInFrames={INTRO_FRAMES + COLD_OPEN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Intro" component={Intro} durationInFrames={INTRO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="ColdOpen" component={ColdOpen} durationInFrames={COLD_OPEN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Launch" component={Launch} durationInFrames={LAUNCH_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="LaunchVertical" component={Launch} durationInFrames={LAUNCH_FRAMES} fps={FPS} width={TALL_STAGE.width} height={TALL_STAGE.height} />
    <Composition id="EditorStill" component={EditorStill} durationInFrames={1} fps={FPS} width={STILL.width} height={STILL.height} />
  </>
);
