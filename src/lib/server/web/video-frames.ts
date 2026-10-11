import type { SafeFetchBytesResult } from '$lib/server/tool-guard';
import { VIEW_MAX_EDGE, viewBytes, type ViewedImage, type ViewOutcome, type ViewPorts } from './view-images';

export const FRAME_POINTS = [0.25, 0.5, 0.75] as const;

export type FramePorts = ViewPorts & {
  fetchVideo: (url: string) => Promise<SafeFetchBytesResult>;
  stills: (video: Buffer, points: readonly number[]) => Promise<Buffer[]>;
};

export type VideoSource = { video: string | null; cover: string | null };

type Seen = { image: ViewedImage; part?: ViewOutcome['parts'][number] };

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const percent = (point: number) => String(Math.round(point * 100));

async function seenOrError(url: string, view: () => Promise<Seen>): Promise<Seen> {
  try {
    return await view();
  } catch (e) {
    return { image: { url, error: errorOf(e) } };
  }
}

async function coverOf(url: string, prefix: string, ports: FramePorts): Promise<Seen> {
  return seenOrError(url, async () => {
    const fetched = await ports.fetchImage(url);
    if (!fetched.ok || !fetched.mime.startsWith('image/')) {
      throw new Error(`the cover server answered ${fetched.status} ${fetched.mime}`);
    }
    return viewBytes(url, fetched.bytes, `${prefix}/cover.jpg`, VIEW_MAX_EDGE, ports);
  });
}

async function framesOf(url: string, prefix: string, ports: FramePorts): Promise<Seen[]> {
  let stills: Buffer[];
  try {
    const fetched = await ports.fetchVideo(url);
    if (!fetched.ok) {
      return [{ image: { url, error: `the video server answered ${fetched.status}` } }];
    }
    stills = await ports.stills(fetched.bytes, FRAME_POINTS);
  } catch (e) {
    return [{ image: { url, error: errorOf(e) } }];
  }
  return Promise.all(stills.map((still, i) => seenOrError(url, () => viewBytes(url, still, `${prefix}/${percent(FRAME_POINTS[i])}.jpg`, VIEW_MAX_EDGE, ports))));
}

export async function viewVideoFrames(source: VideoSource, prefix: string, ports: FramePorts): Promise<ViewOutcome> {
  const cover = source.cover ? [await coverOf(source.cover, prefix, ports)] : [];
  const frames = source.video ? await framesOf(source.video, prefix, ports) : [];
  const seen = [...cover, ...frames];
  return { images: seen.map((s) => s.image), parts: seen.flatMap((s) => (s.part ? [s.part] : [])) };
}
