# Uncensored becomes a project switch, with a new policy

**Why.** The separate uncensored workspace split a user's work in two, and the policy allowed
sexual content of fictional adults. The user decided: no sex at all, artistic nudity only, no
people in references, and the mode is a setting on the project.

**What.**
- Policy (`src/lib/server/moderation/policy.ts`, `profiles.ts`, one rules table in `screen.ts`):
  uncensored allows non-sexual artistic nudity of fictional people, fictional violence, horror,
  satire, strong themes; refuses explicit sex, real/identifiable people, apparent minors. A
  doubtful nude goes to the judge, told to refuse.
- References with people (`moderation/people.ts`, wired in `runGenNode`): every image/video
  reference of an uncensored run is checked by a vision model; detector down refuses. Studio,
  chat/MCP and workflows all pass `runGenNode`.
- Switch: `settings/project` panel, actions `setMode` and `verifyAge` (Didit step moved here;
  `/p/[id]/uncensored` and its `verified` return now land on settings). Direction rules in one
  table, `mode-switch.ts`; the same rules in trigger `projects_mode_direction`
  (`20261003100000_uncensored_mode_switch.sql`), replacing `projects_mode_is_immutable`.
  `mode-switch.sql.test.ts` fails if the trigger's refusal codes drift from the TS table.
- Service role: a switch to uncensored with `auth.uid()` null is refused. No system job needs to
  turn a project uncensored, and the age gate is per person; switching back to standard has no
  age gate, so system cleanup is unaffected.
- Public docs and the public changelog say "age-restricted features", never the internal name;
  `src/lib/content/public-wording.test.ts` guards it. NCII and sexual deepfakes are explicit
  prohibitions.

**Discarded.** Keeping the separate workspace with a link from the project: two places for the
same work. Letting the service role bypass the age gate: an escape hatch nobody uses.
