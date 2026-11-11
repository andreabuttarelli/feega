export const POSTER_MIN_PX = 240;

export type Shot = { id: string; revision: number; posterRevision: number | undefined; blob: Blob; width: number; height: number };

export function posterUploads(send: (shot: Shot) => Promise<unknown>, waitMs: number): (shot: Shot) => void {
  const sent = new Map<string, number>();
  const waiting = new Map<string, { shot: Shot; timer: ReturnType<typeof setTimeout> }>();

  const due = (s: Shot) => s.revision !== s.posterRevision && sent.get(s.id) !== s.revision && Math.min(s.width, s.height) >= POSTER_MIN_PX;

  const fire = (id: string) => {
    const shot = waiting.get(id)?.shot;
    waiting.delete(id);
    if (!shot) {
      return;
    }
    sent.set(id, shot.revision);
    void send(shot).catch((e: unknown) => {
      sent.delete(id);
      console.warn('[canvas] poster not saved', id, e);
    });
  };

  return (shot) => {
    if (!due(shot)) {
      return;
    }
    clearTimeout(waiting.get(shot.id)?.timer);
    waiting.set(shot.id, { shot, timer: setTimeout(() => fire(shot.id), waitMs) });
  };
}
