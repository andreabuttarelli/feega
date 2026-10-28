import { readRulers, writeRulers } from '$lib/shell-prefs';

export const rulersPref = $state({ on: readRulers() });

export function flipRulers() {
  rulersPref.on = !rulersPref.on;
  writeRulers(rulersPref.on);
}
