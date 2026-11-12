# Template descriptions the agent can choose by

The agent picked templates from names: `list_templates` sent each built-in's card line and never its description, no template carried its size, and the library search ignored kind, mode and aspect. Many descriptions were also wrong or empty of facts: all 115 Arc entries are still frames (no keyframes, sizes like 210×84) whose upstream copy promised motion, `text-3d` described a step its graph doesn't have, and look-alikes (three Marquees, two Glitch texts, two End cards...) never said how they differ.

- Arc text now lives in `arc/arc-shows.json`, written from each doc's layers; `arc.ts` prefixes the real size and "no motion".
- Composition layouts, designs and canvas templates rewritten; 32 ports got a differentiator; 10 posters trimmed under 200.
- `list_templates`/`get_template`/`list_components`/REST list send `shape` (`W×H video|still`); `list_templates` sends the description when the card doesn't already hold it.
- `matching()` indexes kind, mode and aspect label.
- Guard: `descriptions.test.ts` (60–320 chars, ends a sentence, unique, deny list).

Discarded: writing the aspect into every description (it drifts from the doc; `shape` is computed). Kept launch/folder descriptions up to 320 chars: the 200 cap is the team-template save schema, built-ins never pass it. Audit: `~/Documents/feega-videos/research/template-descriptions.md`.
