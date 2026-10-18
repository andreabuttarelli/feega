import { COMPOSITION_ID } from '../hyperframes/capture';
import { FONTS_READY } from '../hyperframes/compose';

type Timeline = { seek: (t: number) => void };
type HostWindow = Window & { __timelines?: Record<string, Timeline>; __hf?: { buildReady?: Record<string, Promise<unknown>> } } & Record<string, unknown>;

export type CanvasHost = { at: (t: number) => void; canvas: (id: string) => HTMLCanvasElement | null; dispose: () => void };

const LOAD_TIMEOUT_MS = 30_000;
const OFFSTAGE = 'position:absolute;left:0;top:0;border:0;pointer-events:none';

const settled = <T>(work: Promise<T>) => Promise.race([work, new Promise((ok) => setTimeout(ok, LOAD_TIMEOUT_MS))]);

export async function mountCanvasHost(host: HTMLElement, html: string, size: { width: number; height: number }): Promise<CanvasHost> {
  const frame = Object.assign(document.createElement('iframe'), { srcdoc: html, style: `${OFFSTAGE};width:${size.width}px;height:${size.height}px` });
  const loaded = new Promise((ok) => frame.addEventListener('load', ok, { once: true }));
  host.appendChild(frame);
  await loaded;
  const win = frame.contentWindow as HostWindow;
  await settled(Promise.resolve(win[FONTS_READY]));
  await settled(Promise.all(Object.values(win.__hf?.buildReady ?? {})));
  return {
    at: (t) => win.__timelines?.[COMPOSITION_ID]?.seek(t),
    canvas: (id) => (frame.contentDocument?.getElementById(id) as HTMLCanvasElement | null) ?? null,
    dispose: () => frame.remove()
  };
}
