# Marquee template

Built-in `builtin:marquee`: rows (or columns) of logos, testimonials or images scrolling at constant
speed, seamless wrap, optional edge fade, opposite-direction rows, pause on hover, drag to scrub.

Decisions:

- **Live component with `still(t)`.** Embeds forward pointer input only to live components, so the
  marquee is live. In video, live components play `still`; returning `{ still }` makes the runtime
  draw it from `t`, so the export stays a pure function of time, not a frozen frame.
- **Integer wraps per loop.** Speed is rounded to the nearest one that moves each row a whole
  number of content spans over the clip, so the video loops seamlessly; the field's description
  says so. Defaults (16 wordmarks, 8 testimonials, 24 s) make the asked 0.19 the real speed
  within 10%, held by a test — before, 8 wordmarks over 12 s ran three times faster than shown.
- **Release glide is exact exponential relaxation** toward cruise velocity (integrated in closed
  form, frame-rate independent): no overshoot, no snap-back.
- Cells have fixed sizes from props, so the span is known without measuring the DOM.

