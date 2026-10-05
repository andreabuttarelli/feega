import { ampAt, beatAt, onsetAt, type AudioAnalysis } from '../audio-analysis';
import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { musicBed } from '../beats';
import { ExpressionError, type AudioPort } from './language';

type Reading = (a: AudioAnalysis, seconds: number) => number;

function sounding(doc: MotionDoc, ref: string | number | null): MotionClip[] {
  const audio = clipsOf(doc).filter((c) => c.component === 'Audio');
  if (ref === null) {
    return audio;
  }
  const track = doc.tracks.find((t) => t.id === ref);
  const picked = track ? audio.filter((c) => track.clips.includes(c)) : audio.filter((c, i) => c.id === ref || i + 1 === ref);
  if (!picked.length) {
    throw new ExpressionError(`no audio "${ref}"`);
  }
  return picked;
}

export function audioPort(doc: MotionDoc, analyses: Record<string, AudioAnalysis>, frame: number): AudioPort {
  const bed = musicBed(doc, analyses);
  const hitsOf = (ref: string | number | null) => (ref === null ? (bed ? [bed] : []) : sounding(doc, ref));
  const read = (clips: MotionClip[], reading: Reading) =>
    Math.max(
      0,
      ...clips.flatMap((clip) => {
        const analysis = analyses[String(clip.props.assetId ?? '')];
        if (!analysis || frame < clip.from || frame >= clip.from + clip.durationInFrames) {
          return [];
        }
        return [reading(analysis, (frame - clip.from + clip.trimStart) / doc.fps)];
      })
    );

  return {
    amp: (ref, smoothing) => read(sounding(doc, ref), (a, s) => ampAt(a, s, smoothing)),
    beat: (ref) => read(hitsOf(ref), beatAt),
    onset: (ref) => read(hitsOf(ref), onsetAt)
  };
}
