# Local mode: six providers, cwd .env, key check

**Before.** `src/lib/local-ai-keys.js` knew `KIE_API_KEY`, `LLM_API_KEY`, `OPENROUTER_API_KEY`.
With only Higgsfield, Wiro or ElevenLabs keys the AI gate (`creditGateOutcome`) refused with the
cloud message and the AI nodes stayed hidden (`PUBLIC_FEEGA_LOCAL_AI=0`). Voices were in
`CLOUD_ONLY_ACTIONS`. `scripts/local.mjs` read `.env` only next to the app (`~/.feega/app/<v>/`
under `npx feega`), so a user's `.env` was ignored.

**Now.** `LOCAL_AI_PROVIDERS` declares each provider with its required and optional variables;
`hasAiKey` is true when one provider has all its required ones (Higgsfield needs both halves).
Voices run locally against ElevenLabs. `fileEnv` merges the app's `.env` under the launch folder's
`.env`, under the process environment. `key-checks.ts` probes each keyed provider at start with a
free call (Kie `/chat/credit`, OpenRouter `/key`, Higgsfield status of an unknown request, Wiro
`Task/Detail` of an unknown task, ElevenLabs `/v1/user`); 401/403 = rejected.

`local-providers.test.ts` runs Kie, Higgsfield and ElevenLabs through `runGenNode` with the
provider mocked at `fetch` and checks the bytes land in the `.feega` zip.

**Not changed, on purpose.** Prompt screening of task generations still needs `LLM_API_KEY`
(fail closed). Wiro image/video models stay uncensored-only, and uncensored needs a paid plan, so
locally Wiro is the 3D nodes only. Reference inputs are signed localhost URLs a remote provider
cannot download: image-to-X and 3D still fail locally.
