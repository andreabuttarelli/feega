# Attached app screenshots are shown, not rebuilt small

**Before.** Three real screenshots of an app (versus run1, `app-showcase`) went through
`recreate_ui` with `asset_id`: a vision model reads a capture into a simpler layout. The film
showed a tiny recreated UI unlike the screenshots, 91% of its frames near-black. The launch
film gate also bans a sharp screenshot in the foreground, and the shot builder has no
`add_clip`, so the pictures themselves could not be used.

**Now.**
- `Product` in `PIECES` says how a piece shows the product: `rebuilt` (launch: vector UI from
  the site, shot builder), `pictured` (showcase: the attached screenshots, builder with every
  tool), `absent`.
- `showcase` skips the screenshot ban and the vector-UI share checks (`PIECE_SKIPS`).
- `motionPlaceHint` tells the agent, for each attached image, how to show an app screenshot:
  one `Device3D` moment, then the picture full frame with zoom/focus keyframes on one
  element at a time; never `recreate_ui` it smaller or darker.

**Not done.** A gate that measures how much of the frame an attached screenshot covers;
dark frames are blocked by the dark-frames check (branch `fix/versus-export`).
