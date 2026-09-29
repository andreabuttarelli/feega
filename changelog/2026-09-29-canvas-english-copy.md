# Canvas UI copy in English

The canvas mixed Italian (node labels, add bar, inspector, editors, refusal
reasons shown on a failed connection, create-post errors) with the English of
the rest of the app. Every user-visible literal in `src/lib/canvas/*.ts` and
`src/lib/components/canvas/*.svelte` is now English; tests that asserted the
Italian strings were updated first.

Kept as English literals in place, not moved to `en.json`: another agent had
uncommitted edits there.

Left in Italian on purpose: engine validation reasons in `upstream-inputs.ts`,
`node-data.ts` and `model-params.ts` (server/agent-facing, not rendered as UI
copy), and the `nodeType` values used to build download filenames.
