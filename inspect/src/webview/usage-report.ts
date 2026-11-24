import { ToHost, WebviewUsage, type HostMessage } from '../messages';
import { SIZES, type Size } from './sizes';

const FALLBACK_CLASS = 'Error';
const ERROR_CLASS = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const BREAKPOINT_FLOORS: [number, string][] = [[1536, '2xl'], [1280, 'xl'], [1024, 'lg'], [768, 'md'], [640, 'sm']];

export const errorClassOf = (reason: unknown): string => {
  const name = reason instanceof Error ? reason.name : '';

  return ERROR_CLASS.test(name) ? name : FALLBACK_CLASS;
};

export const breakpointOfSize = (size: Size): string => {
  const width = SIZES[size].width;
  if (width === null) {
    return size === 'full' ? 'base' : 'custom';
  }

  return BREAKPOINT_FLOORS.find(([floor]) => width >= floor)?.[1] ?? 'base';
};

export function watchErrors(send: (message: HostMessage) => unknown, target: Pick<Window, 'addEventListener'> = window) {
  const report = (reason: unknown) => send({ kind: ToHost.Usage, event: WebviewUsage.ErrorWebview, dims: { error_class: errorClassOf(reason), area: 'webview' } });
  target.addEventListener('error', (event) => report((event as ErrorEvent).error));
  target.addEventListener('unhandledrejection', (event) => report((event as PromiseRejectionEvent).reason));
}
