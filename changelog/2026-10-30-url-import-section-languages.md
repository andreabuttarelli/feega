# Section names: role, not topic; five more languages

The AI row is gone: a section name says its role on the page, and "AI 2" said a topic. A section
with a heading and pictures that no row names is now Features; without pictures it stays
`Section N`. Merging a heading block with the media block under it sums their pictures, so the
merged section is judged as one.

Each row of `SECTION_NAMES` carries IT/ES/FR/DE/PT synonyms (Prezzi/Precios/Tarifs/Preise/Preços,
Domande frequenti…, Clienti/Clientes/Kunden, Novità…). Still one table. Accented words avoid `\b`,
which only knows ASCII. "clients" now names Logos only from id/class words, not headings.
