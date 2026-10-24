# Technique node type (migration)

Live techniques (instances that reference `techniques.id`) need a node of type `technique`.

- `20261024120000_technique_node.sql` adds `'technique'` to `nodes_type_check` (same pattern as
  `20261024090000_section_node.sql`: lock and statement timeouts, `not valid` then `validate`).
- The generated and hand-kept mirrors of the check list are updated with it.
- NOT applied. The code that creates instances tolerates its absence and falls back to a copy.
