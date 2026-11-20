# Image fills and text gradients in the editor

Image fill had only a typed URL. "Choose image" now copies a file into the app's public folder (`static/images` for SvelteKit, `public/images` otherwise, never overwriting: `hero-2.jpg`) and writes `/images/x.jpg` through the existing fill writer (`bg-[url(/images/x.jpg)]` in Tailwind). VS Code picks the file with `showOpenDialog`; `npx feega` uploads it over the socket (base64). Size, repeat and position are written per image layer as `background-size/repeat/position` (Tailwind: arbitrary properties).

Typography's Colour row is now the same layered Fill list. Solid-only stays `color`. A gradient or image layer writes `background-image` + `background-clip: text` + `-webkit-background-clip: text` + `color: transparent` (Tailwind: `bg-clip-text text-transparent`). Removing the layers drops the clip and writes the remaining solid back as `color`. An element with its own background is refused with a toast: the clip would swallow it.

Undo removes the written CSS and keeps the copied file. Each property is its own undo step (image, size, repeat, position).

Also: `transparent` now writes `text-transparent` / `bg-transparent`, not `[#00000000]`.

Known gaps: text colour no longer offers "save as variable" in the Fill list; theme tokens still map by value.
