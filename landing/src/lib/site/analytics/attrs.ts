import type { EventName, EventProps } from './events';
import { sendEvent } from './track';

const EVENT_ATTR = 'data-event';
const PROPS_ATTR = 'data-props';
const ALT_PAGE_ATTR = 'data-alt-page';
const EVENT_SELECTOR = `[${EVENT_ATTR}]`;
const ALT_PAGE_SELECTOR = `[${ALT_PAGE_ATTR}]`;
const DOWNLOAD_EVENT = 'download_click';

type EventAttrs = { 'data-event': EventName; 'data-props': string };

export const eventAttrs = <N extends EventName>(name: N, props: EventProps<N>): EventAttrs => ({
  'data-event': name,
  'data-props': JSON.stringify(props)
});

const readProps = (raw: string | null): Record<string, string> => {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }
};

const trackAltLanding = (source: Element, props: Record<string, string>): void => {
  const page = source.closest(ALT_PAGE_SELECTOR)?.getAttribute(ALT_PAGE_ATTR);

  if (page) {
    sendEvent('alt_landing_cta', { page, cta: props.place ?? '' });
  }
};

export const trackFromElement = (element: Element | null): boolean => {
  const source = element?.closest(EVENT_SELECTOR);

  if (!source) {
    return false;
  }

  const name = source.getAttribute(EVENT_ATTR) ?? '';
  const props = readProps(source.getAttribute(PROPS_ATTR));
  const sent = sendEvent(name, props);

  if (sent && name === DOWNLOAD_EVENT) {
    trackAltLanding(source, props);
  }

  return sent;
};

export const trackClick = (event: MouseEvent): void => {
  trackFromElement(event.target instanceof Element ? event.target : null);
};
