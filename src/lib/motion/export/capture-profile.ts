import { Settle } from '../hyperframes/capture';
import { laneCount } from './lanes';
import { deviceInfo } from '../render-place';
import { engineOf } from '../engine';

export enum CaptureProfile {
  Fast = 'fast',
  Exact = 'exact'
}

export const CAPTURE_PROFILES: Record<CaptureProfile, { settle: Settle; lanes: () => number }> = {
  [CaptureProfile.Fast]: { settle: Settle.Seek, lanes: () => laneCount(deviceInfo(navigator), engineOf(navigator.userAgent)) },
  [CaptureProfile.Exact]: { settle: Settle.Paint, lanes: () => 1 }
};

const PROFILES = new Set<string>(Object.values(CaptureProfile));

export function profileOf(value: string | null): CaptureProfile {
  return value && PROFILES.has(value) ? (value as CaptureProfile) : CaptureProfile.Fast;
}
