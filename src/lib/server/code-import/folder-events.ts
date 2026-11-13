import type { FolderStep, StepState } from './folder-source';

const EVENT_PREFIX = 'feega:event ';
const PAGE_STEP = 'page';

type Write = (line: string) => void;

const stdout: Write = (line) => process.stdout.write(`${line}\n`);

export const eventLine = (event: object) => `${EVENT_PREFIX}${JSON.stringify(event)}`;

export const stepEvents =
  (write: Write = stdout) =>
  (step: FolderStep, state: StepState, manager: string) =>
    write(eventLine({ event: 'step', step, state, manager }));

export function pagesCounted<T>(open: () => Promise<T>, total: number, write: Write = stdout): () => Promise<T> {
  let index = 0;
  return () => {
    index = Math.min(index + 1, total);
    write(eventLine({ event: 'step', step: PAGE_STEP, index, total }));
    return open();
  };
}
