import React, { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { MotionComposition, type CompositionProps } from './MotionComposition';

export type PlayerHandle = {
  update: (props: CompositionProps) => void;
  seek: (frame: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  destroy: () => void;
};

export type PlayerEvents = { onFrame: (frame: number) => void; onPlaying: (playing: boolean) => void };

export function mountPlayer(el: HTMLElement, initial: CompositionProps, events: PlayerEvents): PlayerHandle {
  const root = createRoot(el);
  const ref = createRef<PlayerRef>();
  let attached: PlayerRef | null = null;

  const attach = () => {
    const player = ref.current;
    if (!player || player === attached) {
      return;
    }
    attached = player;
    player.addEventListener('frameupdate', (e) => events.onFrame(e.detail.frame));
    player.addEventListener('seeked', (e) => events.onFrame(e.detail.frame));
    player.addEventListener('play', () => events.onPlaying(true));
    player.addEventListener('pause', () => events.onPlaying(false));
    player.addEventListener('ended', () => events.onPlaying(false));
  };

  const draw = (props: CompositionProps) => {
    root.render(
      <Player
        ref={ref}
        component={MotionComposition}
        inputProps={props}
        durationInFrames={props.doc.durationInFrames}
        fps={props.doc.fps}
        compositionWidth={props.doc.width}
        compositionHeight={props.doc.height}
        style={{ width: '100%', height: '100%' }}
        acknowledgeRemotionLicense
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
      />
    );
    queueMicrotask(attach);
    setTimeout(attach, 0);
  };

  draw(initial);

  return {
    update: draw,
    seek: (frame) => ref.current?.seekTo(frame),
    toggle: () => ref.current?.toggle(),
    play: () => ref.current?.play(),
    pause: () => ref.current?.pause(),
    destroy: () => root.unmount()
  };
}
