# Landing follows the updated feega.app

The Framer site changed its pitch from "smart canvas for smarter ideas" to
"the motion canvas for Claude Code", and `landing/` is the copy we ship on
Vercel, so it had to follow.

- New hero: paste-a-website field (sends to the app with `start_url`, the
  `cloneLink` rule restored from git history) and a wall of 20 motion clips.
- New sections: "Open source / Apache-2.0", "Start from any site", "Why not
  Remotion?". The switch and code rows now read "No lock-ins" and "Ship it
  as video or code."
- Pricing: one cloud price (18 / mo) instead of six credit tiers.
- Removed: "If you can imagine it", the AI-subscriptions logos, the 3D
  embed, the provider photos and the model grid, with their images.
- Home title and description now say "Feega", capitalised.

Measured against feega.app at 1440, 1000, 768 and 390 with the stitched
SSIM script; numbers in `~/Documents/feega-videos/landing-port-2/ssim.txt`.
