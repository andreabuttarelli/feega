# The marketing site takes the new feega.app design

`landing/` now reproduces the home page designed in Framer (feega.app): serif
hero with `npx feega`, the AI-native cards, the isometric "imagine" cards, the
MCP subscriptions row, the provider quote, the provider switch and model grid,
Design → Code, the local/cloud pricing, the agents setup, the story section and
the new FAQ. Header and footer follow the same design.

Measured against feega.app with stitched viewport captures and SSIM per
section (1440, 768, 390). The 3D embed and video frames are the main sources of
difference.

Removed: the clone-a-website hero form, the collage, the scenes strip and their
assets, which the new design dropped. The FAQ copy is the new one; the SEO test
now expects "pricing" instead of "cost", "Jitter" and "Flora" in questions.
