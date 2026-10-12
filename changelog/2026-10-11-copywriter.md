# Copywriter: titles from the product's facts, read as one story

User feedback on v5: "the texts make no sense". The director wrote the
on-screen lines while also planning scenes, and nothing checked them as
a sequence.

- `write_script` hands the sourced research to a copywriter sub-call
  (`copywriter.ts`, Opus, label `motion-copywriter`): who, problem,
  what it does, one proof, the promise, the address. Lines ≤ 6 words,
  read in order as one thought. Its lines replace the director's when
  they pass `scriptProblems`; otherwise the director's stay.
- `scriptProblems` refuses any line over 6 words with a cut; the claim
  may split the promise across lines.
- `add_shot` refuses a title slot (`text`, `lines`, `before_text`) that is
  not a script line (case and punctuation ignored) and lists the lines.
- The critic gets the lines numbered in order and judges them as text
  first.
- Roster: `model` and `code` columns; roles that write code (Builder,
  Fixer) resolve to Opus, also for the code tier, by user rule.
