# Sign-in is one centred card under the feega logo

`/login` was a split screen: the form on the left, `login-visual.webp` filling the right half
(hidden under 880 px). The owner asked for the form alone, centred and compact, under the real logo.

- The visual pane and its 880 px breakpoint are gone. The form sits in a 400 px card (`--ui-panel`,
  `rounded-lg`, `--ui-shadow-raised`) on `--ui-app`, centred both ways.
- Above it, the product lockup: `FeegaMark` + `app/Wordmark`, the pair the sidebar uses.
  The class is `lockup`, not `brand`: a global `.brand` in `app.css` adds padding.
- Inputs and buttons use `rounded-md`, one step above the scale's default `sm`, scoped to this page:
  the owner asked for a softer auth screen.
- Field fills are `--ui-wash`/`--ui-divider` instead of `--ui-input`: in dark `--ui-input` is one
  grey off the card and the fields vanished.
- Errors are a tinted `--ui-danger` banner instead of hard-coded `#c0392b` text.
- Auth logic, actions and modes (sign-in, sign-up, forgot) are unchanged.

`static/login-visual.webp` stays: a demo and an e2e spec use it as a sample image.
`/auth/reset-password` keeps its own card shell; it was not part of the request.
