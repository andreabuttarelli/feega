# Import failures from the home prompt read as words

A source attached to the home prompt that failed to import put its raw outcome code (`no_sandbox`) and,
for an uploaded folder, the internal storage path into the agent chat. `home-sources.ts` now maps every
code and Figma outcome through one table (`IMPORT_REFUSAL_TEXT`) with a generic fallback, and an uploaded
folder is named only "Local folder".
