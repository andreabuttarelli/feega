# Home: one prompt to a working canvas

The home `/app` is now a Lovable-style prompt: mega title, chips, a multi-line
composer with image attachments. Send creates the canvas and hands the brief to
the side-chat agent (`handoffPath`), as before.

- **Chips are one table**, `PROMPT_KINDS` in `src/lib/home/prompt-kinds.ts`:
  label, hint for the agent, starting `FramePreset`, phrasing for a bare URL.
  Pitch deck and graphic design come in as one row each.
- **URL in the prompt**: `importUrlInto` runs on the new canvas before the
  handoff (guarded by `assertPublicUrl`); the message names the imported frame
  so the agent edits it instead of recreating it. A failed import still hands
  off the plain brief.
- **Signed out**: `/new` keeps prompt, chip and images in sessionStorage
  (`home-draft.ts`, 4 MB cap) and sets `feega_home_draft`; `landingPath` spends
  the cookie and lands on `/app`, which resumes the send once uploads finish.
- **Agent plan table**, `AGENT_PLANS` in `project-agent/agent-plan.ts`: a credit
  gate denial now means the free tier (Haiku 4.5, 20 user turns per person,
  counted on `chat_messages`); past the cap the original paywall response
  returns. Paid: Opus 5.5 unless the user picked a model.

Discarded: a model picker on the home; a server-side draft table (sessionStorage
is enough and needs no migration). No earlier "20 free edits" mechanism exists in
history — the previous free limit was `FREE_CREDITS` (25, then 0, PR #1805);
the cap here is new. Haiku turns still debit the ledger, so a free org's balance
went negative — fixed: free turns run inside `withoutDebit` (`ai-log.ts`),
logged in `ai_calls` with no ledger debit (`Debit.None` row in `AGENT_PLANS`).

Follow-ups in the same PR: every home send creates a new project and canvas
(home uploads are moved into it with `moveAssets`), which also removes the 404
for a user with no project; signed-out `/` and `/app` redirect to `/new`
instead of `/login` (deeper `/app/*` still go to `/login`).
