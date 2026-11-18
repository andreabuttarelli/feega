const INPUTS = ['keydown', 'pointermove', 'pointerdown', 'click', 'change'] as const;

const tracing = () => (globalThis as { __editTrace?: boolean }).__editTrace === true;

let lastInput = 0;

if (typeof window !== 'undefined') {
  for (const type of INPUTS) {
    window.addEventListener(type, (e) => (lastInput = e.timeStamp), { capture: true, passive: true });
  }
}

export function traceSince(name: string, start: number) {
  if (tracing()) {
    performance.measure(name, { start, end: performance.now() });
  }
}

export const traceSinceInput = (name: string) => traceSince(name, lastInput);
