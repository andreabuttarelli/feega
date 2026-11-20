import { Go } from '@feega/live-edit/go-action';
import type { EventHandler } from '@feega/live-edit/event-handlers';
import type { Wiring } from '../messages';

const CLICK = 'click';
const INLINE = 'inline';

export const GO_CHOICES: { go: Go; label: string; placeholder: string }[] = [
  { go: Go.Page, label: 'Go to page', placeholder: '/pricing' },
  { go: Go.Url, label: 'Open URL', placeholder: 'https://example.com' },
  { go: Go.Section, label: 'Scroll to section', placeholder: '#features' }
];

export const handlerLabel = (event: EventHandler) => event.handler ?? INLINE;

export const clickHandler = (wiring: Wiring) => wiring.events.find((e) => e.event === CLICK);

export const canAddGo = (wiring: Wiring) => wiring.link === null && !clickHandler(wiring);

export const routeChoices = (go: Go, routes: string[]) => (go === Go.Page ? routes : []);
