# A colour edit keeps the other classes

On the traidue.com clone a colour change on the chi-siamo `<h1>` pushed
`text-2xl sm:text-3xl lg:text-4xl text-[#e91e63]`, dropping
`font-heading font-semibold tracking-tight mb-4`.

`sameFamily` in `write-back.ts` decided a token was a text colour by ruling out sizes and
alignments, but never checked the token started with `text-`: every unprefixed class counted as
"colour" and was removed. The family test now applies to colour too.

The new class also takes the place of the one it replaces instead of going to the end, so the
diff is one word. The light-under-dark test now expects `bg-[#fafafa] dark:bg-zinc-900`.

Test: `write-back.test.ts`, the exact traidue class list.
