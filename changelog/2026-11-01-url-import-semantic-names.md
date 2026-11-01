# URL import: components named by section and label

Exported code from a vercel.com import had `Button3.tsx`, `Logo4.tsx`:
`repeated.ts` appended a counter to every second component with the
same role (`uniquelyNamed`), and Logo-set variants were `Variant=1..n`.

- When two or more components share a role, each is named after the
  page section it first appears in (`Hero Button`, `Pricing Button`),
  then after its label, then the counter as last resort.
- A label is, in order: the node's own name when it is not a tag
  (aria-label, alt, id with capitals or spaces), its only text, an image
  alt below it, the image file name. Up to three words; longer or
  numbered (`Features 2`) names are not used.
- Shape variants (`Variant=`) use the label when no other variant has
  it, else the number.
- Role tests on component names (`LABELLED`, `STATEFUL`, `SIZED`) now
  match the role as the last word, since the role is no longer first.

On the v2 captures vercel goes from `Button 2`/`Button 3` to
`Nav Button`/`Get a Demo Button`/`News Button`. Logos drawn as bare SVG
with no label stay numbered: the page gives nothing to name them by.
