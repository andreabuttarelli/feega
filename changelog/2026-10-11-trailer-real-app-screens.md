# Trailer path: real app screens, not the marketing page

Gap between the chatbot and the developer preview (`feega-videos/shots/cursor`:
recreate_ui of the signed-in `/app`, SSIM ~0.98).

**Before.** Eval `2026-10-11T11-47-03/feega`: recreate_ui on `https://www.feega.app/`
signed out; ui-focus with `field_id: text-0` (a text), `button_id: link-4`; whip-zoom
on `link-4`. The critic then removed the UI shots and the agent hand-coded
`FeegaCanvasFlow`/`ToolChaos` cards. The script itself said "serve account di test",
but nobody asked, and the eval driver answered every account request with "no
account, use the public site". v5 (driver gave the account) reached `/app` and the
canvas only after building on the marketing page, pressed `icon-21`, and tinted the UI.

**Now.**
- `add_shot` checks element roles from one table (`SLOT_ROLES` in `shots/ops.ts`):
  `field_id` must be an input, `button_id` a button, link or icon. A UI with no input
  sends the agent to recreate the signed-in work screen.
- `vectorCapture` reports whether the page was read with a kept session
  (`CaptureSession`). recreate_ui of a signed-out page offering "Log in"/"Sign in"
  returns `next`: ask for a TEST account and end the turn before any shot.
- Motion eval driver: the feega case answers with its own throwaway account, as a real
  user would; account requests are heard without a `?`; the cut review is applied
  once, then shipped (no loop); teardowns run on crash and signals; the report is
  written in `finally`.

**Not done.** Per-component SSIM fidelity with re-capture: needs a screenshot in the
capture tab and a server render of the piece. Colour effects on recreated UI are not
refused.
