# Reference pick: the user chooses which Pinterest refs to follow

**Before.** After `pinterest_search` + `view_images` the agent picked references on its own and
built from them. Nothing asked the user's taste; a reference they disliked became the target of
the look and of the `view_frames` comparison.

**Now.** `ask_reference_pick` (in `createWebTools`, so motion and canvas chat share it) ends the
turn with 2–12 candidates. `ChatPanel` draws `ReferencePick.svelte` under that message: tap cycles
follow → avoid → neutral, optional note, Continue. The answer is the next user message: a short
line plus `<reference-pick>{follow, avoid, note}</reference-pick>` JSON with ids and image urls,
because prompt history is text only and the next turn must know the pictures.

Later turns read the latest answer in the thread (`latestAnswer`) and enforce it in code, not
only in the prompt: `view_images`, `import_image` and motion `import_asset` refuse avoided urls,
so they never reach the storyboard or the `view_frames` references; `set_reference_look` merges
them into the new `referenceLook.avoid`.

Skip: a message saying "scegli tu" / "choose for me" removes the tool from the turn.
MCP/API/CLI: the run reports `reference_pick`; the caller answers with
`reference_pick: { follow, avoid, note }` (ids), resolved against the last pick in the thread
(409 when none was asked). CLI: `feega motion ask <id> "" --follow … --avoid …`.

Reload: `ask_reference_pick` output is kept whole in the mirrored row (`OUTPUTS_READ_BACK`), and
`pickCards` marks each card waiting, answered or passed.

Discarded: a structured column on `chat_messages` (a migration for what a tagged message already
carries); filtering references by url inside `viewedReferences` (image parts carry no url).
