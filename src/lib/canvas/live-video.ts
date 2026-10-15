export enum View {
  Readable = 'readable',
  Overview = 'overview'
}

export enum Playback {
  Paused = 'paused',
  Playing = 'playing'
}

export type VideoPlace = { view: View; onScreen: boolean; selected: boolean; playback: Playback };

export function videoMounted(place: VideoPlace): boolean {
  if (place.selected || place.playback === Playback.Playing) {
    return true;
  }
  return place.onScreen && place.view === View.Readable;
}
