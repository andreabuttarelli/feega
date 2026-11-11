# Third-party notices

## Portions derived from OpenPencil (MIT)

Source: https://github.com/open-pencil/open-pencil, commit `1c1986b20d15f2556c563d6c59d14a006269a40a`.
Translated and adapted to this codebase; upstream comments removed, formats and APIs changed.

Ported from upstream files:

- `packages/scene-graph/src/types.ts` (vector network types) → `src/lib/motion/vector/model.ts`
- `packages/core/src/vector/curve-math.ts` → `src/lib/motion/vector/curve-math.ts`
- `packages/core/src/vector/bezier.ts` → `src/lib/motion/vector/edit.ts`
- `packages/core/src/vector/regions.ts` → `src/lib/motion/vector/regions.ts`
- `packages/core/src/vector/path-helpers.ts` → `src/lib/motion/vector/path-sink.ts`
- `packages/core/tests/vector/stroke-runs.test.ts` → `src/lib/motion/vector/path-sink.test.ts`

```
MIT License

Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Turbulence lattice from the W3C filter effects reference (W3C Software and Document License)

Source: the `feTurbulence` reference implementation in the W3C Filter Effects Module Level 1
(https://www.w3.org/TR/filter-effects-1/#feTurbulenceElement). The seeded random generator, the
lattice/gradient set-up and the stitching arithmetic are reimplemented in
`src/lib/motion/gpu-full/turbulence.ts` and in the noise shader of
`src/lib/motion/gpu-full/filters-gpu.ts`, so the GPU grain matches what browsers draw.

Copyright © 2018 W3C® (MIT, ERCIM, Keio, Beihang). Used under the W3C Software and Document
License: https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document

## Portions derived from snapcn (MIT)

Source: https://snapcn.dev (https://github.com/shadcn-labs/snapcn), the free registry components only.
Translated from React/Remotion to feega custom components in
`packages/motion-core/src/motion/snapcn/`; upstream comments removed, APIs changed. No "Pro" component is included.

```
MIT License

Copyright (c) 2026 Sri Nath (snap-cn)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Portions derived from Paper Shaders (Apache-2.0)

Source: `@paper-design/shaders` 0.0.82 (https://github.com/paper-design/shaders). The pulsing border shader
and its noise texture are inlined in `packages/motion-core/src/motion/snapcn/ports/pulsing-border.ts`.
Licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).

```
Paper Shaders
Copyright 2026 Paper
```

## Portions derived from free-remotion-templates by RenderComp (MIT)

SPDX-License-Identifier: MIT. Source: https://github.com/RenderComp/free-remotion-templates, all 50 templates.
Translated from React/Remotion to feega custom components in
`packages/motion-core/src/motion/rendercomp/`; upstream comments removed, APIs changed.

```
MIT License

Copyright (c) 2026 Trimora Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
