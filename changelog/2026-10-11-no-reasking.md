# The extra builder turns of the linear/stripe trailers

Eval `2026-10-11T14-38-15`, per-turn `ai_calls`: linear's builder line ($3.2) was four turns.
Two ($1.22, $1.20) answered "Salta: non ho un account di prova" sent by the eval driver to
status reports, two ($0.40 each) were "Ship the cut" after them. Stripe had the same shape.

Two causes, both fixed:

- Driver (`scripts/eval/motion-quality/drive.ts`): `asksUser` treated any mention of
  "account" as a question. It now remembers the account answer (`AccountGiven.Declined` /
  `Yes`, via `accountAfter`); after it, only a real question (`?` at the end) is answered.
- Agent (`frames.ts` `SUMMARY_ASK`): the closing summary asked for "anything left to
  decide", so every turn ended on a question — at 14:55 it asked again for a test login the
  user had declined at 14:51. It now states what stays open, asks only when it cannot go on,
  and never re-asks what the user answered.

Discarded: persisting the declined account in the script to relax the signed-in-screen
gates (touches the gates other work is changing; the prompt rule covers the observed case).
