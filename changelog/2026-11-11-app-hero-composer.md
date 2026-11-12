# /app hero takes the landing composer

The home prompt now matches the landing hero card: kind tabs with icons inside the card, an inset
field whose placeholder follows the kind (`PROMPT_KINDS[kind].placeholder`), and one bottom row with
attach (+), the sources as icon+label buttons, the model label and a round send that turns accent when
there is something to send. Under 640px the sources collapse into an "Import" dropdown.

`PromptSources` now renders the row and takes `before`/`after` snippets for attach and send, so the
pick logic stays in one place. Colours use `--ui-*` tokens, not the landing's hard-coded ones. The
model label is fixed to "Opus 5.5": the page has no plan data to pick Haiku for free plans.
Behaviour (kinds, sources, attachments, draft prefill, `?/video`) is unchanged.
