# Landing block says what Feega does

The block under the hero read "Open source. Apache-2.0. Works with Claude Code, Codex, Cursor." plus
a row of agent logos. It named a license and three tools but not what Feega does.

It is now one sentence: open the Feega VS Code extension in your codebase, design directly in your
real app with your agents (the three logos inline, glued to "agents"), then move to Feega Cloud
(link to the app) to collaborate in real time. Open source and Apache-2.0 stay stated in the FAQ,
`llms.ts` and `structured-data.ts`.

Claims checked in code: realtime and presence on hosted (`src/lib/realtime/canvas-channel.ts`), none
in local mode (one machine, 127.0.0.1 only). "Feega Cloud" is new wording; the pricing plan is
named "Cloud".

Open: the extension (`vscode/`) is not published; Marketplace and Open VSX listings answer 404.
This text should not reach production until it is installable.
