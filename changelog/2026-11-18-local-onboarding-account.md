# Local onboarding: an optional sign-in first, Feega Cloud only once signed in

Local mode's first step, "where should your work live?", offered **Feega Cloud** to everyone,
with "a built-in AI that designs and generates images and video for you". Without a login that
choice did nothing (`place` only changed the art line), and the promise was false: in local mode
the cloud chat never runs.

What the code does, unchanged by this entry:

- `LocalOff.Chat` is always on in local mode, so `RightBar` mounts `AcpChatPanel`: the chat runs
  the user's own agent over ACP (`runAcpTurn`), on their plan with it. No Feega credits.
- `creditGateOutcome` in local mode allows AI nodes only with an own provider key
  (`hasAiKey`), billed by the provider; otherwise 403 `local_mode`. A connected account is not
  read there.
- A connected account (`~/.config/feega/session.json`) only forwards name and memory to the cloud.

What changed:

- New `Step.Account`, first for a first run with no account: a login card shaped like the app's
  compact `/login` (lockup, Google, GitHub, email and password, "Create one", one "Skip"),
  centered with no art or progress (`Layout.Card` in `STEPS`). Email and password go to
  `POST /api/v1/local/account/sign-in` → `signIn()` in `cloud-account.ts`: the Supabase password
  grant, the same call the hosted `/login` makes through `signInWithPassword`. Only the resulting
  session is written to `session.json`, as the browser callback does; the password lives in that
  request only. Google, GitHub and "Create one" start the existing browser flow
  (`session.connect()`), since OAuth has to happen in a real browser; the card says "finish
  signing in in your browser". The provider marks moved from `/login` to `ProviderIcon`.
- `cloudDeps()` read the hosted Supabase URL and key from `PUBLIC_SUPABASE_*`, which
  `scripts/local.mjs` sets to a dead stub (`http://supabase.invalid`): under `npm run local` the
  browser callback could not resolve the user and every connect failed. It now reads
  `FEEGA_CLOUD_SUPABASE_URL` / `FEEGA_CLOUD_SUPABASE_KEY`, defaulting to the hosted project.
  `Step.Home` follows on every local first run. Without an account its Feega Cloud card is shown
  but its radio is `disabled`, with "sign in to use Feega Cloud" and a "← sign in" link back to
  the account step. `joined()` rebuilds the plan in `STEPS` order (adding Name and Memory), and
  `connect()` then advances from the account step, so a finished sign-in lands on the place
  choice with Feega Cloud enabled.
- `StepHome` places are radios picked by click, not `mouseenter`. Feega Cloud's button opens the
  cloud app (`cloud` now returned by `GET /api/v1/local/onboarding`, from `cloudDeps`) and moves on.
- The agent picker loses its inert "Feega cloud" tile (and its mark); with no agent it reads
  "none picked". The hint no longer says the chat spends credits.

Discarded: an explanatory first step ("this computer" vs "a feega account" cards). The
explaining belongs to the place step; step one is only a login.

Discarded: hiding Feega Cloud without an account (the first version of this change). Shown but
disabled tells the user what signing in adds and where to do it.

Discarded: billing the local chat to the connected account's credits. Nothing in the code does
that today; it would be a cloud proxy for chat and generation, a feature of its own.
