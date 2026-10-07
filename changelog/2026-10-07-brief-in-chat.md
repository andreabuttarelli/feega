# Brief in chat before the build

Before: `write_script` returned the brief and the prompt asked the model to repeat it. In supasito
v3 the model kept building in the same turn and never echoed it: the brief lived only inside a
collapsed tool row.

Now the turn stops on the step that saves the script (`briefAwaits` as a stop condition of the
edit round; no self-check, no summary, no still-open note). `ChatPanel` shows `ScriptBrief` for the
last assistant turn that saved one: research and script, compact and expandable, "Build it",
"Change it", and a countdown (`BRIEF_AUTO_GO_S`, 8 s) that sends `GO_MESSAGE` as a new turn. Typing
in the composer or pressing "Change it" holds the countdown; a correction is a normal message, and
the prompt asks to call `write_script` again with it.

Discarded: a server-side timer that resumes the turn alone. It would keep a function alive for
seconds doing nothing, and the CLI/MCP path (`ask`) already continues with a follow-up prompt.
