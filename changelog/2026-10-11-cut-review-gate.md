# Cut review gate: the user sees the critic before fixes are spent

After the first cut, the critic's contact sheet (stored under
`web-views/critic-sheet-*/sheet.jpg`, served by the existing web-views
route) and its fixes become a `review_cut` tool on the saved answer. The
chat shows a card: Apply fixes / Apply, and stop asking / Keep it as is.
Each answer is plain text (`cutAnswer`), so chat, API, CLI and MCP answer
the same way; `GET` run state carries `cut_review` with the exact answer
texts, and the canvas chat gets a `next` relay (`relayed`, one table for
pick and cut).

"Go ahead without asking" is the answer text itself, persisted in
chat_messages: `cutGate` scans the thread, so it survives reloads with no
new column. "scegli tu"-style prompts also skip the gate.

The storyboard gate already existed (brief card with storyboard mini and
an 8 s auto-go); not changed here.
