const PARAM = 'coreWorker';
const ON = '1';

export function coreWorkerOn(search: string): boolean {
  return new URLSearchParams(search).get(PARAM) === ON;
}
