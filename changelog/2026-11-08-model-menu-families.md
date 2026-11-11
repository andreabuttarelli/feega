# Model menu grouped by family

The generative node's model menu was a stack of submenus by maker (Google,
ByteDance…) with a third submenu for providers, labels straight from the catalogue
and no prices.

Now: two columns. Families on the left (Claude, GPT, Gemini, Veo, Kling, Flux…),
models on the right, newest first, with clean names ("Sonnet 5.5") and the dollar
price per medium unit. Providers (Auto / Kie.ai / Wiro / OpenRouter) are a chip row
under the list, Auto still the default; the node still receives the same model id
and `provider` param.

- `src/lib/canvas/model-families.ts`: one registry table (family → label, icon,
  match rule on id/label) plus `modelName`, `priceLabel`, `priceHeader`,
  `familyGroups`, `searchModels`. Unknown vendors fall back to their provider with
  a monogram.
- `model-picker.ts` removed: only the old menu used it.
- Prices are credits ÷ `CREDITS_PER_USD_SUBSCRIPTION_LIST`, the list rate.
- Icons: `simple-icons` (CC0), already a dependency, rendered monochrome.
- Discarded: a per-row provider submenu (three levels deep again).
