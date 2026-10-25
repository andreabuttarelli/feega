import { sampleColor, sampleTrack, type Keyframe } from '../keyframes';
import { jellyOf, jellyStrains, type Strain } from './geometry';
import { BLOB_NUMBERS, BLOB_NUMBER_KEYS, BLOB_TINT, type BlobNumberKey } from './model';
import { blobShape, centreOf, poseRow, radiusOf, strainTarget, type BlobPose, type BlobSize, type BlobValues } from './shape';

export type BlobClip = { props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined>; durationInFrames: number };

const valueAt = (clip: Pick<BlobClip, 'props' | 'keyframes'>, key: BlobNumberKey, frame: number) => {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame) : Number(clip.props[key] ?? BLOB_NUMBERS[key].fallback);
};

export const blobValues = (clip: Pick<BlobClip, 'props' | 'keyframes'>, frame: number) => Object.fromEntries(BLOB_NUMBER_KEYS.map((key) => [key, valueAt(clip, key, frame)])) as BlobValues;

export function blobTint(clip: Pick<BlobClip, 'props' | 'keyframes'>, frame: number, resolve: (v: string) => string): string {
  const track = clip.keyframes[BLOB_TINT.key];
  return track?.length ? sampleColor(track, frame, resolve) : resolve(String(clip.props[BLOB_TINT.key] ?? BLOB_TINT.fallback));
}

function targetStrain(clip: BlobClip, frame: number, at: BlobSize): Strain {
  const now = blobValues(clip, frame);
  const path = { before: centreOf(blobValues(clip, frame - 1), at), here: centreOf(now, at), after: centreOf(blobValues(clip, frame + 1), at), seconds: 1 / at.fps };
  return strainTarget(path, radiusOf(now, at), now.stretch);
}

export function blobStrains(clip: BlobClip, at: BlobSize): Strain[] {
  const frames = Array.from({ length: clip.durationInFrames + 1 }, (_, f) => f);
  const targets = frames.map((f) => targetStrain(clip, f, at));
  const jellies = frames.map((f) => jellyOf(valueAt(clip, 'viscosity', f)));
  return jellyStrains(targets, jellies, at.fps);
}

export function blobPose(clip: BlobClip, frame: number, strain: Strain, at: BlobSize, resolve: (v: string) => string): BlobPose {
  return blobShape(blobValues(clip, frame), blobTint(clip, frame, resolve), strain, at);
}

export function blobRows(clip: BlobClip, at: BlobSize, resolve: (v: string) => string): number[][] {
  const strains = blobStrains(clip, at);
  return strains.map((strain, frame) => poseRow(blobPose(clip, frame, strain, at, resolve)));
}
