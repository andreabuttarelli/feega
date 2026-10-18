# A snapshot asked for before a move no longer undoes it

With a second tab writing (two-tab scorecard), every peer change made
this tab refresh its snapshot. A snapshot requested before the user's
last move but answered after that move was saved carried the older
position, and `keepPlaced` adopted it because the move was no longer
dirty: the box jumped back one step, then forward on the next refresh.

Placement saves now stamp each node with a counter; a refresh records
the counter when it asks, and keeps the local placement of any node
placed after that.
