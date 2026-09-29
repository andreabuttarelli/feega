# Stop reading the missing `chat_model_catalog` table

Every request ran `catalogModelIds()` in `hooks.server.ts`. The table was
never created on the current project, and an error left the cache cold, so
each request retried: about 7,300 404s a day. Per "app leads", the read goes:
the chat picker shows `LLM_MODELS` or the code fallback, and the default model
is `LLM_DEFAULT_MODEL`. `newModelsForCatalog` stays.
