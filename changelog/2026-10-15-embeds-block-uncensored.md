# A live motion embed blocks the switch to uncensored

Gap left by #638: a motion embed is a storage file (`embeds/<nodeId>.html`), not a token column,
so the switch facts in `mode-switch.ts` never saw it. An embed published while the project was
standard stayed public at `/e/[id]` after the project turned uncensored.

Now `liveEmbeds` checks every live motion node of the project with `embedPublished` and counts as
`hasShares`, so the switch is refused with the existing `NOT_SHAREABLE` code; its text now says to
unpublish the video embeds too. Same code, not a new one: the DB trigger
(`20261003100000_uncensored_mode_switch.sql`) must raise exactly the app's codes
(`mode-switch.sql.test.ts`), and a new code would need a migration for a check the trigger cannot
make anyway (it does not read storage). The trigger still guards the token columns; embeds are
guarded by the app path, the only one that switches mode.

Cost: one storage list per motion node on a switch to uncensored, a rare action.

Guard: `mode-switch.embeds.test.ts`: refused with a live embed, allowed after unpublishing.
