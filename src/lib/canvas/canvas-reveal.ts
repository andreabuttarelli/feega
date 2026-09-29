const REVEAL_EVENT = 'canvas-reveal';

const reveals = new EventTarget();

type VisibilitySource = EventTarget & { visibilityState: DocumentVisibilityState };

export function revealCanvas() {
  reveals.dispatchEvent(new Event(REVEAL_EVENT));
}

export function onCanvasReveal(refetch: () => void, doc: VisibilitySource = document): () => void {
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') {
      return;
    }
    refetch();
  };

  reveals.addEventListener(REVEAL_EVENT, refetch);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    reveals.removeEventListener(REVEAL_EVENT, refetch);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
