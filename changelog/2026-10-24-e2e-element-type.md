# E2E specs read free elements by node type

`canvas-text-autowidth-typing` and six other `@real` specs found no free
text after Escape and looked like data loss. They were not: since #1212 a
free element is `nodes.type = 'element'` with no `data.kind`, and the specs
still filtered `data.kind === 'element'`, so they counted zero rows that
were saved. The specs now filter on `type`. No product code changes.
