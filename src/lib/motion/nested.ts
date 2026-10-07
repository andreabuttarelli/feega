import { screenCompOf } from './device-screen';

type NestingClip = { component: string; props: Record<string, unknown> };

const NESTED: Record<string, (clip: NestingClip) => string | null> = {
  Precomp: (clip) => String(clip.props.comp ?? '') || null,
  Device3D: (clip) => screenCompOf(clip)
};

export const nestedComp = (clip: NestingClip) => NESTED[clip.component]?.(clip) ?? null;
