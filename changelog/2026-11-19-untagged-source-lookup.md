# Source lookup without Feega tags

Pages without `data-feega-src` now resolve sources from framework metadata: Svelte `__svelte_meta`, React `_debugSource` (18) / `_debugStack` (19), Vue `__file` (file-level, line 1). The bridge stamps the attribute on inspect/tree, so selectors and writers are unchanged.

The Vite ATTACHABLE row no longer requires tags, so a user's own Vite server can be attached.

Not done yet: "Open from URL…" command, `npx feega --url`, no-source-info message.
