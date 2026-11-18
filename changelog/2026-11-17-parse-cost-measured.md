# What a cold motion doc parse costs, and a guard on its output

The canvas-open budget assumed `parseMotionDoc` cost ~115 ms + 25 ms clone per 1.15 MB frame on
a cold read. Profiled on the 36-frame stress canvas (84 MB of real docs, warm process, first
parse of each doc): **~27 ms per 1.15 MB frame** (24 ms/MB: zod 8.5, clone 5.8, structural
checks 9.8 — of which ~2/3 is `salvageProps`, the per-clip props parse). The first parse in a
brand-new process costs ~54 ms (JIT and schema warm-up, paid once per process, not per frame).
`upgradeDoc` is ~0 on current docs. The ≤ 50 ms target was already met.

Two output-neutral cuts: `titleLook` no longer runs `defaultProps(id)` (a full zod parse of `{}`)
for every clip — it is skipped for non-title components and memoised per id for Title/Text; and
`withParams` is built once per clip instead of twice. Gain ~1–2 ms per 1.15 MB frame.

`src/lib/motion/parse-output.test.ts` pins the output hash of 162 valid docs (older v1–v4 shapes
included) and the exact error of 18 invalid ones; `MOTION_DOCS_JSON=<docs.json>` adds an outside
corpus, recorded beside it on first run.

Not done, because not low-risk: dropping the JSON clone (zod output aliases `z.unknown()` input
and shared defaults; the clone also drops `undefined` and `-0`), a single pass over clip props
instead of the record pass plus `salvageProps`.

Replaces the sealed-doc approach (#2332, closed): seals sped a frame up only after its next save,
went stale on every parser change or `APP_SECRET` rotation, and signed a member-writable field.
