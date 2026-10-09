# Titles: semibold or medium, very tight tracking

Video titles came out at whatever weight the style or the agent picked (launch film used 800,
the default Title -0.045 tracking, scene lines -0.02). Rule now: weight 500–600, tracking
-0.04 to -0.06 em, matching the app's mega titles (600 / -0.04em).

- `TITLE_TYPE_RULE` (`style.ts`) in launch film and apple minimal rules (UI morph has no titles).
- Defaults: `TITLE_LOOK` (`components.ts`, 600 / -0.05). `Title` schema defaults to it;
  `parseProps` fills it on `Title`/`Text` at `HEADLINE_SIZE` (0.06, the text-over-scene threshold,
  moved here from `style.ts`) when weight/tracking are not given. Body text keeps 400 / -0.01.
- Gate `title-type` (Warning, `TITLE_CARDS` styles): a headline outside weight 500–600 or tracking
  -0.07..-0.04. Missing props read as the defaults.
- Recipes: launch film display weight 800 → 600; scene `display` and headline lines use -0.05; the
  quote templates are headline-size, so semibold now. Every builtin template passes the gate (test).
- Discarded: a `z.preprocess` on the schemas — it would hide the props from `z.toJSONSchema` in
  the inspector. UI kit type (UI-native labels) untouched.
