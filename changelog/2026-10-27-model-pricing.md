# Per-provider, per-resolution model prices; three-level model menu

**Before.** The model menu showed one number for every route of a model: Nano Banana 2 read
$0.05 on Auto, OpenRouter and Kie.ai alike, Pro $0.11. Causes:

- OpenRouter prices Gemini image models per output token. `offerable-models.ts` only read
  per-image lines, so the OpenRouter route had no price at all: the Generate button lost its
  cost when OpenRouter was chosen.
- The menu spread `route.price` over the choice. After JSON transport the `undefined` keys of
  an unpriced route vanish, so OpenRouter inherited Auto's (Kie's) price.
- The menu listed each route's minimum over resolutions, never the node's resolution.
- Production `main` still hard-codes Kie prices (`1K`/`2K` for NB2, `1K` only for Pro); `dev`
  already reads the live Kie list, which has 4K.
- Specced videos used a flat measured median per family (Grok $0.12, Seedance $2.10, others
  $2.10) times a 480p/720p multiplier, with no 1080p price.

**Now.**

- `image-output-tokens.ts`: tokens per resolution for the Gemini image models (Google's
  published counts). Times the synced per-token cost, they give OpenRouter a price per
  resolution.
- `video-pricing.ts`: per-second USD from the synced row (`duration_seconds_*`,
  `cents_per_*second*`, Seedance `video_tokens` at 24 fps / 1024 px per token), with and
  without audio. `ModelChoice.perSecondCredits` carries it; `creditsForRun` multiplies by
  duration at the node's (snapped) resolution.
- Model menu: makers → models → API route (Auto / OpenRouter / Kie.ai) with `$`/`$$`/`$$$`
  tiers from `route-tiers.ts`, computed with `creditsForRun` at the node's params. Exact numbers
  live only on the Generate button.

- A node with no resolution set showed the first option (512 for Nano Banana 2) while the
  provider rendered 1K. `defaultResolution` in `gen-node.ts` is now the one answer: 1K when the
  model offers it, else its first option. The toolbar, the quote and the server request
  (`generate.ts` snaps before calling the provider) all read it.

**Not done.** Token-priced models other than Gemini (GPT Image, MAI) stay "variable": no
published token count per image. FLUX video upscale (per megapixel-second) keeps the flat price.
