# One first-run flow for web, desktop and local

Before: web had a six-slide tour (`HowFeegaWorks`) that opened on arrival; local mode and the
desktop app had no first run at all, signup never asked for a name, and the cloud chat had no
memory about the person (only `brand_memory`, and a project has no brand by default).

Now `Onboarding.svelte` is mounted in the root layout on every surface. Which steps a viewer gets is
one table, `STEPS` in `src/lib/onboarding/flow.ts`:

| Step | Shows when |
|---|---|
| where it runs | first run in local mode |
| your name | signed in and `profiles.name` is empty (also for existing users) |
| your AI | first run in local mode (agents from `detectCached`) |
| your memory | first run and signed in |

- The tour no longer opens by itself; it stays behind "how feega works" in the sidebar. The new flow
  reuses `profiles.onboarding_seen_at` as its seen flag on the web.
- Local mode keeps its flag in `~/.feega/onboarding.json` and never asks for a login. "Connect your
  account" starts the same browser login as `feega login` against a one-shot loopback listener and
  writes the CLI's `~/.config/feega/session.json`; name and memory are then proxied to the cloud.
- Memory is `profiles.agent_memory` (migration `20261118120000_profiles_agent_memory.sql`, **not
  applied yet**), read by `startProjectTurn` and appended to the project agent prompt as a fenced
  `<user_memory>` block. Web imports it with a prompt the user pastes into their AI; local mode can
  also read the agent files found on disk (`memory-sources.ts`, one table, ids only).
- The left panel is the landing's ASCII field. `ascii-field.ts` is copied from `landing/`, which is
  a standalone site and shares no package with the app.

The copy was tested on isolated readers (Haiku and Sonnet, no repo, only screenshots). First draft:
both got the two modes but not what the product makes, and stumbled on "agents" and "keys". The
shipped copy says what Feega makes in the first sentence and calls agents "AI assistants".

Not in this change: the agents step in the desktop app's cloud mode (needs a bridge in Electron;
ADR 0036 keeps ACP out of the cloud), publishing a local file to the cloud from the flow, and a
feature video.

Rejected: live collaboration in local mode (a second sync system beside the cloud one), a paywall
or trial step, a pixel-art scene (too close to the reference).
