import { offsetOf, type LiveAt } from './class-patch';
import { dataSource } from './data-source';
import type { ReadFile } from './files';
import { attributesOf, locationOf, type Attribute } from './open-tag';

export type EventHandler = { attribute: string; event: string; handler: string | null; at: LiveAt };

const FORWARDED = 'forwarded';
const IDENTIFIER = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const PLAIN_NAME = /^[A-Za-z_$][\w$]*$/;

const DOM_EVENTS = new Set([
  'click', 'dblclick', 'auxclick', 'contextmenu', 'mousedown', 'mouseup', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousemove',
  'pointerdown', 'pointerup', 'pointermove', 'pointerenter', 'pointerleave', 'pointercancel',
  'touchstart', 'touchend', 'touchmove', 'touchcancel',
  'keydown', 'keyup', 'keypress', 'input', 'change', 'beforeinput', 'submit', 'reset', 'invalid', 'select',
  'focus', 'blur', 'focusin', 'focusout', 'scroll', 'wheel', 'resize', 'load', 'error', 'toggle',
  'drag', 'dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop', 'copy', 'cut', 'paste',
  'play', 'pause', 'ended', 'animationend', 'transitionend'
]);

const KNOWN = (name: string) => (DOM_EVENTS.has(name) ? name : null);

const EVENT_SYNTAXES: { pattern: RegExp; event: (name: string) => string | null }[] = [
  { pattern: /^on([A-Z][A-Za-z]*)$/, event: (name) => name.toLowerCase() },
  { pattern: /^on([a-z]+)$/, event: KNOWN },
  { pattern: /^on:([a-z]+)(?:\|.*)?$/, event: KNOWN },
  { pattern: /^(?:@|v-on:)([A-Za-z-]+)(?:\..*)?$/, event: (name) => name.toLowerCase() }
];

export function eventNameOf(attribute: string): string | null {
  for (const { pattern, event } of EVENT_SYNTAXES) {
    const name = attribute.match(pattern)?.[1];
    const found = name === undefined ? null : event(name);
    if (found) {
      return found;
    }
  }
  return null;
}

function handlerOf(attribute: Attribute): string | null {
  if (attribute.value === null) {
    return FORWARDED;
  }
  const expression = attribute.value.trim();
  return IDENTIFIER.test(expression) ? expression : null;
}

async function declaredAt(read: ReadFile, file: string, text: string, handler: string | null): Promise<LiveAt | null> {
  if (!handler || !PLAIN_NAME.test(handler)) {
    return null;
  }
  return (await dataSource(read, file, text, `{${handler}}`))?.at ?? null;
}

export async function eventsOf(read: ReadFile, at: LiveAt): Promise<EventHandler[]> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  if (text === null || start < 0 || text[start] !== '<') {
    return [];
  }
  const found: EventHandler[] = [];
  for (const attribute of attributesOf(text, start)) {
    const event = eventNameOf(attribute.name);
    if (!event) {
      continue;
    }
    const handler = handlerOf(attribute);
    const declared = await declaredAt(read, at.file, text, handler);
    found.push({ attribute: attribute.name, event, handler, at: declared ?? locationOf(text, attribute.start, at.file) });
  }
  return found;
}
