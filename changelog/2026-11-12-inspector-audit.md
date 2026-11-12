# Inspector audit: every control operated by mouse and keyboard

A text layer of a URL-imported landing showed a fill no one could edit: a variable chip in place
of the fill row, an × that would not turn it back into a plain fill, and a + whose menu opened
but took no click. The unit suite was green throughout, because nothing exercised the inspector
the way a person does.

`tests/e2e/inspector-audit.spec.ts` now does. It runs on local mode (no Supabase, no login) with
a fixture built from the real motion model (`tests/e2e/fixtures/inspector-audit/fixture.ts`): one
frame with a layer of every kind (rect, ellipse, line, star, path, text, image, auto-layout stack
and child, group, component instance, mask, effects, effect style, text bound to a variable with
a text style, null) and a frame cut from the Stripe URL import (variables, styles, bindings).

Two parts:

- **Sweep** (`INSPECTOR_AUDIT_SWEEP=1`): for every layer kind, opens every section, then checks
  every visible control: the centre is not covered (`elementFromPoint`), it has an accessible
  name, it is at least 20 px on its short side, it is in the tab order; every trigger with
  `aria-expanded` is clicked and its popup's controls checked the same way, then Escape must
  close the popup, keep the layer selected and give focus back.
- **Table** (`fixtures/inspector-audit/controls.ts`): one row per control × option × state. Each
  row is operated twice, once with real pointer events at the visible centre and once by
  keyboard only (Tab from the section head, Enter/arrows/typing), and must change the saved
  document, change the pixels of the layer when it should, and come back with undo.

Rows that fail today carry a `known` marker with the failing checks, severity and reference, so
the suite is green now and turns red both when a working control breaks and when a known defect
is fixed without removing its marker.

Not run in CI on every PR: it needs headed Chrome, takes minutes, and drives a WebGPU canvas.
Run it locally with `npx playwright test -c tests/e2e/inspector-audit.config.ts`.
