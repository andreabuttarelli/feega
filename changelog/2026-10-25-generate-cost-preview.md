# Provider price comparison on the Generate button

The button already showed the credits of a run (`runQuoteOf`) and the model
menu already listed one row per provider. What was missing was the
comparison at the point of decision.

- `providerQuotesOf` (`src/lib/canvas/run-quote.ts`) re-runs the same
  `runQuoteOf` once per route, so every number is what the button would
  show with that provider picked, variants and duration included.
- The comparison hides unless two providers serve the model; Auto is
  listed but never flagged cheapest, since it resolves to one of them.
- Rejected: a second price function for the tooltip. Prices still come from
  the catalogue and `billedCreditsFor`; no multiplier is copied here.
