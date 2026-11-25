import { track } from '@vercel/analytics';
import { EVENTS, MAX_VALUE_LENGTH, type EventName, type EventProps } from './events';

type Props = Record<string, string>;

export const isEventName = (name: string): name is EventName => Object.hasOwn(EVENTS, name);

const hasExactlyAllowedKeys = (name: EventName, props: Props): boolean => {
  const keys = Object.keys(props);
  const allowed: readonly string[] = EVENTS[name];

  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
};

const clip = (props: Props): Props => Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value).slice(0, MAX_VALUE_LENGTH)]));

export const sendEvent = (name: string, props: Props): boolean => {
  if (!isEventName(name) || !hasExactlyAllowedKeys(name, props)) {
    return false;
  }

  track(name, clip(props));

  return true;
};

export const trackEvent = <N extends EventName>(name: N, props: EventProps<N>): boolean => sendEvent(name, props);
