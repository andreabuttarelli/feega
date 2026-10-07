import type { MotionDoc } from './doc';
import { ExportFormat, FORMAT, type RenderSettings } from './export-formats';
import type { Capabilities } from './export-plan';
import { Resolution } from './render-quote';

export const BROWSER_RENDER_CREDITS = 0;

export enum RenderPlace {
  Browser = 'browser',
  Farm = 'farm'
}

export enum FarmReason {
  Background = 'background',
  Format = 'format',
  NoEncoder = 'no_encoder',
  Device = 'device',
  NoAudio = 'no_audio'
}

export enum Device {
  Desktop = 'desktop',
  Mobile = 'mobile',
  WeakMobile = 'weak_mobile'
}

export type DeviceLimit = { maxResolution: Resolution; maxSeconds: number; label: string };

export const DEVICE_LIMITS: Record<Device, DeviceLimit> = {
  [Device.Desktop]: { maxResolution: Resolution.P1080, maxSeconds: 600, label: 'this computer' },
  [Device.Mobile]: { maxResolution: Resolution.P1080, maxSeconds: 180, label: 'this phone' },
  [Device.WeakMobile]: { maxResolution: Resolution.P720, maxSeconds: 60, label: 'this phone' }
};

const WEAK_MEMORY_GB = 3;
const RESOLUTION_ORDER: readonly Resolution[] = [Resolution.P720, Resolution.P1080, Resolution.P1440, Resolution.P2160];

const BROWSER_FORMATS: ReadonlySet<ExportFormat> = new Set([ExportFormat.Mp4H264]);

export type DeviceInfo = { mobile: boolean; memoryGb: number | null; cores: number | null };
export type PlaceInput = {
  doc: Pick<MotionDoc, 'width' | 'height' | 'fps' | 'durationInFrames'>;
  settings: RenderSettings;
  capabilities: Capabilities;
  device: Device;
  background: boolean;
  hasAudio: boolean;
};
export type PlaceVerdict = { place: RenderPlace.Browser } | { place: RenderPlace.Farm; reason: FarmReason; message: string };

type Rule = { reason: FarmReason; applies: (i: PlaceInput) => boolean; message: (i: PlaceInput) => string };

const above = (r: Resolution, max: Resolution) => RESOLUTION_ORDER.indexOf(r) > RESOLUTION_ORDER.indexOf(max);
const seconds = (i: PlaceInput) => i.doc.durationInFrames / i.doc.fps;
const encoderMax = (c: Capabilities) => (c.h264 ? Resolution.P1080 : Resolution.P720);
const limit = (i: PlaceInput) => DEVICE_LIMITS[i.device];

const RULES: readonly Rule[] = [
  {
    reason: FarmReason.Background,
    applies: (i) => i.background,
    message: () => 'Renders on our servers: you can close this tab, the video lands in your assets.'
  },
  {
    reason: FarmReason.Format,
    applies: (i) => !BROWSER_FORMATS.has(i.settings.format),
    message: (i) => `${FORMAT[i.settings.format].label} cannot be encoded in a browser: it renders on our servers.`
  },
  {
    reason: FarmReason.NoEncoder,
    applies: (i) => !i.capabilities.webCodecs || (!i.capabilities.h264 && !i.capabilities.h264At720),
    message: () => 'This browser cannot encode video: it renders on our servers. A recent Chrome, Edge or Safari renders it for free.'
  },
  {
    reason: FarmReason.Device,
    applies: (i) => above(i.settings.resolution, encoderMax(i.capabilities)) || above(i.settings.resolution, limit(i).maxResolution),
    message: (i) => `${i.settings.resolution} is more than ${limit(i).label} can encode: it renders on our servers. Pick a lower resolution to render it here for free.`
  },
  {
    reason: FarmReason.Device,
    applies: (i) => seconds(i) > limit(i).maxSeconds,
    message: (i) => `${Math.round(seconds(i))} s is longer than ${limit(i).label} can hold in memory (${limit(i).maxSeconds} s): it renders on our servers.`
  },
  {
    reason: FarmReason.NoAudio,
    applies: (i) => i.hasAudio && !i.capabilities.aac,
    message: () => 'This browser cannot encode the audio track: it renders on our servers so the sound stays in.'
  }
];

export function renderPlace(input: PlaceInput): PlaceVerdict {
  const rule = RULES.find((r) => r.applies(input));
  return rule ? { place: RenderPlace.Farm, reason: rule.reason, message: rule.message(input) } : { place: RenderPlace.Browser };
}

export function deviceOf(info: DeviceInfo): Device {
  if (!info.mobile) {
    return Device.Desktop;
  }
  return info.memoryGb !== null && info.memoryGb < WEAK_MEMORY_GB ? Device.WeakMobile : Device.Mobile;
}

const MOBILE_UA = /iPhone|iPad|iPod|Android|Mobile/i;

export function thisDevice(nav: Navigator): Device {
  const hints = (nav as Navigator & { userAgentData?: { mobile?: boolean }; deviceMemory?: number }).userAgentData;
  const memory = (nav as Navigator & { deviceMemory?: number }).deviceMemory;
  const touchMac = nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent);
  return deviceOf({ mobile: hints?.mobile ?? (MOBILE_UA.test(nav.userAgent) || touchMac), memoryGb: memory ?? null, cores: nav.hardwareConcurrency ?? null });
}
