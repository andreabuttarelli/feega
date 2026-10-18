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
