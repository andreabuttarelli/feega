# A node moved aside to free canvas is brought into view

After `placeNear` (#556) a node added from the bar no longer lands on others, but when the view
centre is taken it goes to the nearest free cell, often outside the view: in the demo walk the
second image and the video landed off-screen and the user saw nothing happen. When the spot is
not the view centre (`offCentre`), the canvas now fits the view on the new node, as it already
does for a node created from a selection.
