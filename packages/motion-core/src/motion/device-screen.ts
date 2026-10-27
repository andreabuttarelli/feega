import { DEVICE, DeviceKind, type Device } from './devices';

export const SCREEN_FACES: Record<DeviceKind, number> = {
  [DeviceKind.Phone]: 1,
  [DeviceKind.Foldable]: 2,
  [DeviceKind.Laptop]: 1,
  [DeviceKind.Monitor]: 1,
  [DeviceKind.Tablet]: 1,
  [DeviceKind.Browser]: 1
};

export const SCREEN_HOST_MARK = '-scr';

export const screenHostId = (deviceId: string, face: number) => `${deviceId}${SCREEN_HOST_MARK}${face}`;

export const facesOf = (device: Device) => SCREEN_FACES[DEVICE[device].kind];

type ScreenClip = { component: string; props: Record<string, unknown> };
type CompFrame = { width: number; height: number };
type FramedDoc = { tracks: readonly { clips: readonly (ScreenClip & { id: string })[] }[]; comps: Record<string, { frame?: CompFrame }> };

export function screenCompOf(clip: ScreenClip): string | null {
  return clip.component === 'Device3D' && clip.props.screenComp ? String(clip.props.screenComp) : null;
}

export function screenFrames(doc: FramedDoc): { prefix: string; frame: CompFrame }[] {
  return doc.tracks
    .flatMap((t) => t.clips)
    .flatMap((clip) => {
      const comp = screenCompOf(clip);
      const frame = comp ? doc.comps[comp]?.frame : undefined;
      return frame ? Array.from({ length: facesOf(clip.props.device as Device) }, (_, face) => ({ prefix: `${screenHostId(clip.id, face)}__`, frame })) : [];
    });
}
