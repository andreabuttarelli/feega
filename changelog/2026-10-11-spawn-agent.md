# spawn_agent: the chat agents write their own sub-agents

Motion chat and canvas chat get `spawn_agent({ prompt, label?, kind?,
tools?, model?, budget_usd })`. Rules in one place (`agents/spawn.ts`):

- depth 1: the tool is never handed to a sub-agent;
- at most `MAX_SPAWN_PARALLEL` (3) at once; parallel = several calls in
  one step (the SDK runs them together);
- budget carved from the turn's remaining cap, reserved while running,
  stopped on max(rate-card estimate, gateway bill);
- model: free pick from the gateway catalogue (prices in the tool
  description); default by task kind (`KIND_MODEL`: Opus for visual,
  code, judgement; Sonnet for mechanical, reading, extraction; Haiku for
  simple checks); any code-writing tool forces Opus; a frame-looking
  tool refuses a model that cannot see;
- writes go through the same tools on the same session doc, so the
  turn's versioned save and conflict retry apply;
- ai_calls row per sub-agent with agent_key `spawned:<label>`;
- shown in chat as the collapsible tool row labelled Sub-agent (input =
  prompt/model, output = text, cost, edits).

MCP: external agents already are agents; no tool added there. The
parallel shot crews are not yet rebuilt on spawn_agent.
