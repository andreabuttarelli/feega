# Mixed-size text keeps the block's size on import

Importing the Acme pricing page (a Vite app, folder upload) put "Choose Starter"
below its card; Team and Scale were fine.

Cause: `textNode` in `page-tree.ts` picked the base style of a text from the
segment holding the most characters. In `<p class="price">$0<span>/mo</span></p>`
the 16px `/mo` (3 letters) beat the 40px `$0` (2), so the text came in as 16px
with a 40px run. "$29/mo" and "$99/mo" had the 40px part in the majority. The
canvas sizes a hugging text from its base style, so the Starter price grew and
pushed the button out of the card.

Now a segment set at the block's own font size wins; character count only
breaks ties. Discarded: largest size wins, which would make a paragraph with one
oversized inline word take that word's size.

Test: `page-tree.browser.test.ts`, "a block whose smaller span holds more
letters than its own text".
