export const COMPILING_FIRST_PAGE = 'Compiling the first page…';

type PhaseRow = { pattern: RegExp; label: string };

const PHASES: PhaseRow[] = [
  { pattern: /re-?optimi[sz]/i, label: 'Optimizing dependencies…' },
  { pattern: /paraglide/i, label: 'Compiling translations…' }
];

export function phaseOfLine(line: string): string | null {
  return PHASES.find((row) => row.pattern.test(line))?.label ?? null;
}

export function phaseFeed(post: (text: string | null) => void) {
  let active = false;
  let shown: string | null = null;
  const show = (text: string | null) => {
    if (text === shown) {
      return;
    }
    shown = text;
    post(text);
  };
  return {
    begin: () => {
      active = true;
      shown = null;
    },
    line: (line: string) => {
      const phase = active ? phaseOfLine(line) : null;
      if (phase) {
        show(phase);
      }
    },
    show: (text: string) => active && show(text),
    finish: () => {
      active = false;
      show(null);
    }
  };
}
