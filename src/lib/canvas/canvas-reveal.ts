import { Trigger } from './staleness';

const REVEAL_EVENT = 'canvas-reveal';

const reveals = new EventTarget();

type VisibilitySource = EventTarget & { visibilityState: DocumentVisibilityState };

type Refetch = (trigger: Trigger) => void;

export function revealCanvas() {
  reveals.dispatchEvent(new Event(REVEAL_EVENT));
}

export function onCanvasReveal(refetch: Refetch, doc: VisibilitySource = document, win: EventTarget = window): () => void {
  const onReveal = () => refetch(Trigger.Return);
  const onOnline = () => refetch(Trigger.Online);
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') {
      return;
    }
    onReveal();
  };
  const onPageShow = (event: Event) => {
    if (!(event as PageTransitionEvent).persisted) {
      return;
    }
    onReveal();
  };

  reveals.addEventListener(REVEAL_EVENT, onReveal);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('focus', onReveal);
  win.addEventListener('pageshow', onPageShow);
  win.addEventListener('online', onOnline);
  return () => {
    reveals.removeEventListener(REVEAL_EVENT, onReveal);
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('focus', onReveal);
    win.removeEventListener('pageshow', onPageShow);
    win.removeEventListener('online', onOnline);
  };
}
