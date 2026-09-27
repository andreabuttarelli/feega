# Generation previews use each model's price

Image nodes assigned every integrated model the same historical average and left new catalogue
models without a preview. The actual debit was already correct because completed generations use
the provider's reported `usage.cost`; only the pre-run estimate was wrong.

## What changed

- The model sync follows each image model's endpoint URL and stores its definitive pricing lines.
- The canvas converts flat per-image prices through the same credit ladder used for billing.
- Price variants override the base estimate when the selected resolution activates them.
- Models discovered from the provider receive a preview without requiring a local model entry.
- Token-, megapixel- and paid-reference models say `costo variabile` when their final consumption
  cannot be known before generation; the UI does not invent a number.
- When OpenRouter offers multiple image providers, the preview uses the cheapest route eligible
  for the selected resolution or quality without pinning it.
- Text nodes calculate input and expected output separately with the selected model's live rates.
  Input uses the same system prompt, local prompt and connected text that generation sends. Jev
  refines the expected output length, with a deterministic fallback when it is unavailable.
- Connected image, video or audio inputs keep the text preview variable because their billed
  token count is only known after the provider processes them.
- The node counter and loop preview use the same per-run estimate; loop totals recalculate for
  every combination instead of multiplying the old fixed text allowance.

## Verification

The live read-only test synchronized the current OpenRouter catalogue and its pricing endpoints:
more than 50 image models, multiple distinct fixed prices, a 7-unit Seedream 5 Lite preview, and
variable pricing for Seedream 5 Pro and GPT Image 2.5. A second live test checked distinct input
and output rates across the current text catalogue. No generation ran and no provider credit was
spent.
