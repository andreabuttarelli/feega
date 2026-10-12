# Marquee template (draft)

Built-in `builtin:marquee`: rows (or columns) of logos, testimonials or images scrolling at constant
speed, seamless wrap, optional edge fade, opposite-direction rows, pause on hover, drag to scrub.

Decisions:

- **Live component with `still(t)`.** Embeds forward pointer input only to live components, so the
  marquee is live. In video, live components play `still`; returning `{ still }` makes the runtime
  draw it from `t`, so the export stays a pure function of time, not a frozen frame.
- **Integer wraps per loop.** Speed is rounded so each row travels a whole number of content spans
  over the clip: the video loops seamlessly. With few long items the floor of one wrap can make a
  row faster than the asked speed.
- **Release glide is exact exponential relaxation** toward cruise velocity (integrated in closed
  form, frame-rate independent): no overshoot, no snap-back.
- Cells have fixed sizes from props, so the span is known without measuring the DOM.

Open: `direction.ts` still reports a live-scene warning ("a still stands in") for it in videos,
which is no longer true for components that return `still`.
