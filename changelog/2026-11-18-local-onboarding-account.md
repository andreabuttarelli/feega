# Local onboarding: an optional account first, Feega Cloud only once connected

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

- New `Step.Account`, first for a first run with no account: optional, "connect your account" or
  "continue without an account". `Step.Home` shows only once connected; `joined()` already
  rebuilt the plan in `STEPS` order, so connecting mid-flow adds Home, Name, Memory after it.
- `StepHome` places are radios picked by click, not `mouseenter`. Feega Cloud's button opens the
  cloud app (`cloud` now returned by `GET /api/v1/local/onboarding`, from `cloudDeps`) and moves on.
- The agent picker loses its inert "Feega cloud" tile (and its mark); with no agent it reads
  "none picked". The hint no longer says the chat spends credits.

Discarded: billing the local chat to the connected account's credits. Nothing in the code does
that today; it would be a cloud proxy for chat and generation, a feature of its own.
