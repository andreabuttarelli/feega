import { siGithub } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { Mark } from "../../components/brandIcons";
import { Align, Headline } from "../Headline";
import { CREW, Parade, Pixel } from "../pixel";
import { Pointer, pointerAt } from "../Pointer";
import { Place, Section } from "../Section";
import { INK, ORANGE, PAPER, Tone, UI } from "../style";

export const OPEN_SOURCE_FRAMES = 105;
export const STAR_CLICK = 66;
export const OPEN_SOURCE_TONE = Tone.Orange;

const BURST = 9;
const BURST_REACH = 260;
const CREW_JUMP = 70;

const OPEN_BOXED = "open\u00a0source";
export const OPEN_LINES = ["free and", `${OPEN_BOXED}.`];

const CHIP_W = 640;

export const OpenSource = () => {
  const frame = useCurrentFrame();
  const chip = tween(frame, 24, 16);
  const starred = frame >= STAR_CLICK;
  const pop = tween(frame, STAR_CLICK, 8);
  const burst = lift(frame, STAR_CLICK, 22);
  const jump = Math.sin(Math.PI * tween(frame, STAR_CLICK + 2, 12));
  const pointer = pointerAt(frame, [
    { at: 36, x: 700, y: 260 },
    { at: STAR_CLICK - 2, x: 70, y: 46 },
  ]);

  return (
    <Section tone={OPEN_SOURCE_TONE} eyebrow="09 · open source">
      <Place x={0} y={250} style={{ width: 1920 }}>
        <Headline lines={OPEN_LINES} boxed={OPEN_BOXED} tone={Tone.Orange} size={150} align={Align.Center} />
      </Place>
      <Place x={(1920 - CHIP_W) / 2} y={680} style={{ transform: `translateY(${(1 - chip) * 500}px)` }}>
        <div style={{ width: CHIP_W, height: 96, borderRadius: 48, background: PAPER, display: "flex", alignItems: "center", gap: 18, padding: "0 34px", fontFamily: UI, fontSize: 30, color: INK, position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,.18)" }}>
          <div style={{ transform: `scale(${1 + 0.3 * Math.sin(Math.PI * pop)})` }}>
            {starred ? <Pixel sprite="star" size={6} /> : <Mark mark={{ path: siGithub.path, viewBox: "0 0 24 24" }} size={44} color={INK} />}
          </div>
          <span style={{ flex: 1 }}>{starred ? "starred" : "star on github"}</span>
          <span style={{ color: starred ? ORANGE : "#8a8780", fontSize: 24 }}>github.com/…/feega</span>
          {starred
            ? Array.from({ length: BURST }, (_, i) => {
                const angle = (i / BURST) * Math.PI * 2;

                return (
                  <div key={i} style={{ position: "absolute", left: 60, top: 30, opacity: 1 - burst, transform: `translate(${Math.cos(angle) * BURST_REACH * burst}px, ${Math.sin(angle) * BURST_REACH * burst}px) rotate(${burst * 180}deg)` }}>
                    <Pixel sprite="star" size={5} />
                  </div>
                );
              })
            : null}
          {frame >= 36 ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - STAR_CLICK) < 3} /> : null}
        </div>
      </Place>
      <Place x={0} y={880} style={{ width: 1920, display: "flex", justifyContent: "center", transform: `translateY(${-CREW_JUMP * jump}px)` }}>
        <Parade sprites={CREW} size={8} start={30} gap={38} stagger={2} />
      </Place>
    </Section>
  );
};
