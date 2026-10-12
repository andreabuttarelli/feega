# Image globe motion template (draft)

Eighth hand-made template: photo/video tiles on a fibonacci sphere assemble (staggered, pure in-out expo, growing out from 0.55 R), the globe turns a whole number of times per loop, then the title enters with the shared word entrance while a veil dims the globe.

- **CSS 3D, not WebGL.** 32 flat tiles in one `preserve-3d` container: crisp images, none of the export's 16 WebGL contexts, deterministic by construction. three.js would add lighting nobody asked for, at the cost of a context and texture uploads.
- **Spin** only goes forward: a quintic lead on entry and exit, with the steady rate lowered so the total stays a whole number of turns (seam test).
- **Back tiles** are shaded toward the background by how far they face away, never hidden with `backface-visibility` (that pops).
- Media reader and video seek extracted from floating media into `template/media-list.ts` (separate commit).
- Step 1 only: no library preview yet.
