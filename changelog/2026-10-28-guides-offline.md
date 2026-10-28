# Guides tab: an unusable index is offline, not blank

`CanvasGuideTab` only showed the offline message when `fetch` rejected or the body was not JSON. A non-2xx response with a JSON body, or an empty index, parsed to `[]` and rendered an empty tab with no message. `fetchGuides` now rejects on a non-ok response or an index with no valid guides. The component, layout and CSP were checked and are fine.
