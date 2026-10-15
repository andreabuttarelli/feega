# Properties and Chat on a phone: one bottom sheet, always reachable

Reported: on a phone it was unclear how to reach Properties and Chat while editing a frame, an
element in it, a free element or a group. Desktop is unchanged by request.

Audit (390×844, 412×915, 820×1180; `before-*` in `~/Documents/feega-videos/screens/side-panel/`):

| State | Phone before | iPad |
|---|---|---|
| (a) canvas, nothing selected | Canvas · Chat switch; no Properties | chat column |
| (b) frame selected | no Properties; only "Open editor" on the tile | Properties right, chat via toggle |
| (c) frame open | grey text row "Properties · Agent" at the foot | same as (b) |
| (d) element in a frame | selecting did not open Properties | Properties right |
| (e) free element | tap selects; no way in (a chromeless tile has no "Open editor") | opens on Properties |
| (f) group | same as (e) | selects; double-click enters |

Now (phone only; tablet and desktop untouched):

- `MobileViewSwitch` has a Properties segment, disabled with nothing to show. It is lit by
  `propertiesTarget` (one selected motion node, published by the canvas page through
  `src/lib/canvas/phone-properties.ts`); a tap sets `propertiesRequest`, the page calls
  `requestMotion`, `InlineMotionEditor` reads the request and opens the shell with
  `opensOn: OpensOn.Properties`.
- In the shell a new selection (clip or part) snaps the sheet to Properties at peek, even over
  Chat. A still/group doc has no timeline, so at peek the body is padded by the sheet height and
  the stage re-fits above it.
- The foot tabs are icon + label with a pressed state, `Properties · Chat` ("Agent" is gone). The
  chat sheet head carries `Editing: <name>` (clip name, else frame name); the canvas chat shows
  the same chip for the selected node.
- The draw bar hides while a phone sheet is open, and follows the transport (or the tabs, on a
  still) when there is no timeline: before, it sat on the tabs.
- The canvas chat sends `selection` (node ids); the agent route keeps uuids only (max 20) and the
  prompt names them, so "this" means the selection.

Discarded: auto-opening the editor on a canvas tap. Phone opening is `OnRequest` on purpose (a tap
must still move nodes); the lit Properties segment is the explicit way in.

Guards: `phone-properties.test.ts`, `system-prompt.test.ts`, e2e `phone-side-sheet.spec.ts`
(states a–f at iPhone and Android sizes).
