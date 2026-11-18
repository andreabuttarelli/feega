# Local chat detects installed ACP agents

Before: the local chat offered a hardcoded three (Claude, Codex, Gemini) whether installed or
not, remembered the pick in `localStorage`, and launched Gemini with the deprecated
`--experimental-acp`. A missing agent failed only after the first message.

Now `AGENT_CATALOG` (`src/lib/server/acp/detect.ts`) is the one table of agents: binaries,
native ACP args or `npx` adapter, install and login commands, credential files and API-key env
vars. `detectWith` looks in `PATH`, common install dirs and the `npx` cache, runs only
`<bin> --version` (3 s timeout), checks credentials by existence and never reads them. Results
are cached in-process; `?refresh=1` reruns. The ACP route launches the detected absolute path
and answers 409 for an agent that cannot run.

`GET/PUT /api/v1/local/acp/agents` lists agents and saves the pick in the `.feega` manifest
(`acpAgent`, optional, so older files and older readers are unaffected). CLI: `feega agents`.

Desktop: the login-shell `PATH` is now read between markers, so an rc file that prints a banner
no longer corrupts it.

Launch commands come from the ACP registry
(https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json) and
https://agentclientprotocol.com/overview/agents.

Discarded: an MCP op. The MCP server is what the agent uses; listing agents is a choice for the
person at the picker, and the MCP also runs against the cloud where detection means nothing.
Discarded: downloading registry binaries (Amp, Goose...) on demand: it would be an install.
