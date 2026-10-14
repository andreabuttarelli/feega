export const HERO_TITLE = 'design that moves.';
export const HERO_SUBLINE = 'an ai canvas for interaction design — generate, compose, animate.';

export const HERO_BACKDROP = { poster: '/home/hero-flow.jpg', video: '/home/hero-flow.mp4' };

export type BackdropSignals = { reducedMotion: boolean; saveData: boolean; tabVisible: boolean; inView: boolean };

export function backdropPlays(signals: BackdropSignals): boolean {
  return !signals.reducedMotion && !signals.saveData && signals.tabVisible && signals.inView;
}
