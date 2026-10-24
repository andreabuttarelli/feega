# Skills in a node's prompt

F2 (flora-vs-feega). Prompts were retyped from scratch on every node.

- Table `prompt_skills` (org-level, `name` kebab-case + `body`, soft delete, RLS `auth_org_ids()`).
  Needs migration `20261024100000_prompt_skills.sql`: NOT applied. Until it is, the repo answers
  `unavailable` and the picker is empty (same tolerance as `effects` and `layouts`).
- Typing `/` at a word start in a Generate node's prompt opens a picker (`canvas/prompt-skills.ts`:
  `slashQueryAt`, `filterSkills`, `insertSkill`); arrows, Enter/Tab insert the body in place of
  `/query`, Escape closes. "Save as skill" under the prompt stores the current prompt under a name.
- Browser reads and writes through `/api/v1/projects/[id]/agent/prompt-skills` (session, project
  reach), agents and CLI through `/api/v1/org/prompt-skills` (+ `[id]` DELETE), both on
  `repos/prompt-skills.ts`.
- GenNode: the derived `state` was renamed `runState`; it shadowed the `$state` rune.
- Not done: MCP tool and CLI command for skills (REST only), editing a skill body in place
  (saving under the same name overwrites), `/` in text-only nodes other than Generate.
