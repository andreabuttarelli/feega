export const COPIED_MS = 1500;
export const SNACKBAR_MS = 3000;
export const SNACKBAR_TEXT = 'Paste the instructions into your agent';

export type Feedback = { copied: string | null; snackbar: boolean };

export function copyFeedback(show: (feedback: Feedback) => void): (key: string) => void {
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  let snackbarTimer: ReturnType<typeof setTimeout> | undefined;
  let current: Feedback = { copied: null, snackbar: false };

  const update = (change: Partial<Feedback>) => {
    current = { ...current, ...change };
    show(current);
  };

  return (key) => {
    clearTimeout(copiedTimer);
    clearTimeout(snackbarTimer);
    update({ copied: key, snackbar: true });
    copiedTimer = setTimeout(() => update({ copied: null }), COPIED_MS);
    snackbarTimer = setTimeout(() => update({ snackbar: false }), SNACKBAR_MS);
  };
}
