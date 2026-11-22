import { AbsoluteFill } from "remotion";
import { EDITOR_REST, FeegaEditor } from "./editor/FeegaEditor";
import { WIN } from "./editor/layout";
import { loadFonts } from "./style";

const STILL_SCALE = 2;

export const STILL = { width: WIN.w * STILL_SCALE, height: WIN.h * STILL_SCALE };

export const EditorStill = () => {
  loadFonts();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ transform: `scale(${STILL_SCALE})`, transformOrigin: "0 0" }}>
        <FeegaEditor state={{ ...EDITOR_REST, selected: 1, hover: 1 }} />
      </div>
    </AbsoluteFill>
  );
};
