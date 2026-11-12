# Local mode does not moderate

An agent driving a local canvas over MCP could draw a frame but not add text: the text went
through the moderation check, which needs `LLM_API_KEY`, and failed with "Add LLM_API_KEY to .env".

Local mode runs on the user's machine with their own keys and responsibility, so it now skips
moderation. One row: `ModerationProfile.Local` in `MODERATION_PROFILES` has `Screening.Off`;
`profileForEnv` picks it from `PUBLIC_FEEGA_LOCAL`, `moderationPorts` carries it and
`screenGeneration` clears before any rule, Jev or judge call. Every caller (text edits, task runs,
prompt enhancement) goes through those two, so none changed. Cloud profiles are `Screening.On`.

Not touched: the people check on references. It applies to uncensored projects only, which local
mode does not have.
