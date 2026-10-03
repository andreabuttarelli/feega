import { CAPTURE_REQUEST, type CaptureReply, type CaptureRequest } from './capture';

export const CAPTURE_TIMEOUT_MS = 15_000;

export type PlayerPort = {
  load: (html: string) => void;
  seek: (seconds: number) => void;
  post: (message: CaptureRequest) => boolean;
  onReady: (listener: () => void) => () => void;
  onReply: (listener: (reply: CaptureReply) => void) => () => void;
};

export type ShotRequest = Omit<CaptureRequest, 'type' | 'id'>;

export type PreviewDriver = {
  loaded: (html: string) => Promise<void>;
  shoot: (time: number, request: ShotRequest) => Promise<CaptureReply>;
};

export function previewDriver(port: PlayerPort, newId: () => string = () => crypto.randomUUID(), timeoutMs = CAPTURE_TIMEOUT_MS): PreviewDriver {
  function loaded(html: string): Promise<void> {
    return new Promise((resolve) => {
      const off = port.onReady(() => {
        off();
        resolve();
      });
      port.load(html);
    });
  }

  function shoot(time: number, request: ShotRequest): Promise<CaptureReply> {
    const id = newId();
    port.seek(time);
    return new Promise((resolve, reject) => {
      const done = (settle: () => void) => {
        clearTimeout(timer);
        off();
        settle();
      };
      const timer = setTimeout(() => done(() => reject(new Error('capture timed out'))), timeoutMs);
      const off = port.onReply((m) => {
        if (m.id !== id) {
          return;
        }
        done(() => (m.error ? reject(new Error(m.error)) : resolve(m)));
      });
      if (!port.post({ type: CAPTURE_REQUEST, id, ...request })) {
        done(() => reject(new Error('preview not ready')));
      }
    });
  }

  return { loaded, shoot };
}
