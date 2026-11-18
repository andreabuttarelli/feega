# Main/instance rules on push

`routedEdits` (`code-import/instance-edits.ts`) sits between `editsOf` and `applyEdits`. An edit whose clip carries `source.via` (the JSX usage site, new optional field in the motion-core source schema) is an instance edit: text that equals a string prop at the usage site rewrites that prop; a style becomes `style={{...}}` at the usage when the component destructures `style`; anything else becomes a `PropProposal` and nothing is written. `EditTarget.Main` (push `mains`, CLI `--main`, panel checkbox) sends the edits to the component file as before.

`frameStatus` returns `affected` (shared files with the number of page links whose import graph includes them, from `LinkStore.inProject`) and `proposals`.

Deferred: the capture does not fill `source.via` yet, so instance routing is reachable only from docs that carry it; the agent call that adds a missing prop is a stub (the proposal is listed, not acted on).

E2E (`github-sync.e2e.test.ts`): main edit -> one file, 3 pages affected; instance text -> prop at one site; no fitting prop -> proposal; apply to main -> component file.
