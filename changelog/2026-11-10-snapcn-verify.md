# snapcn templates: Play on canvas, video media, phone-stack

An end-to-end pass over the 61 snapcn templates (insert, live play, MP4 export, media pickers, agent tools) found four defects.

- **Play on canvas did nothing on a template.** `FrameLiveControls` drew the live iframe only for `interactive` frames, while the Play inspector offers the switch for every frame. The iframe now follows `frameLive` alone; the hover switch stays interactive-only.
- **The live page was white in local mode.** It loads `/motion-player.js`, which `local-mode.ts` did not route and answered 404. It is now a runtime route.
- **phone-stack threw on every frame.** Its draw used a module constant; the port is serialised with `toString()` and the constant does not exist in the player. A new `sweep.test.ts` runs every port from `snapcnSource` (the code the player executes) with defaults and with every media field filled, so a reference outside the draw fails a test instead of a render.
- **Clips never showed in exports or posters.** The GPU DOM reader painted `<video>` as a media gap. `probe.ts` now rasterises a component's own `<video>` like an `<img>`, after its seek settles (3 s cap so a broken clip cannot stall an export). Ports also read `kind: 'video'` from the media list (`S.videoOf`) instead of trusting a file extension, so a signed URL without one still plays as video.

Not fixed here, recorded in the PR: the GPU export of `card-rail` and `roster-grant` draws an empty frame while their HTML composition is correct; laptop-frame media is drawn outside the tilted, rounded screen.
