# Scroll story motion template (draft)

Fourth hand-built premium template: three chapters on a visible grid,
phased (hold, eased move, hold, eased move, hold; fields for hold,
move and easing; scrub maps scroll to the same phases). The
headline is pinned in the centre and swaps line by line (masked, staggered,
pure in-out expo, no overshoot: nothing ever moves back) at each chapter boundary; each
chapter image drifts upward on its own grid column at its own speed, with a
light inner parallax. Labels, chapter index and a progress hairline sit on
the grid.

- Pure function of `t` (`STORY_MODEL`), CSS only, built with the shared
  `customTemplateDoc`; runtime vars use the `story_` prefix.
- Defaults to scrub playback (scroll length 4). `customTemplateDoc` takes an
  optional `playback`; `insertTemplate` adopts it only while the target video
  is still on default autoplay, so a chosen playback is kept. Video exports
  ignore playback and play through.
- Chapter count fixed at 3 for now.
- Default images: picsum.photos ids 1015, 1039, 1043 (Unsplash License).
