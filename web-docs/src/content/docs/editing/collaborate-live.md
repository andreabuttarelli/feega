---
title: Collaborate live
description: Share your running app with teammates who edit it with you, and review every change they make.
sidebar:
  order: 10
---

Share the app you are editing and teammates open it in their browser, see the same page and edit it from the same Properties bar. Their changes land in your files, so you keep one copy of the code and one history.

## Start a session

Click **Share** in the editor header, name the project, choose whether visitors can edit, and start. Copy the link and send it. Guests sign in to Feega; sharing needs a Feega Cloud plan, guests only need an account.

The session ends when you stop sharing, after 30 minutes with nobody in it, or at its time limit.

## What everyone sees

Each person gets a colour. Their selected element is outlined in that colour with their name, and their pointer is drawn on the preview. You see the guests this way in the editor, and guests see you and each other.

A guest who is **Editor** can edit. A **Viewer** can only look and comment. In **Who is here** you can switch a person between the two, or remove them.

## Edits are applied by you, in order

Guest edits reach your editor over the connection and are applied one at a time in the order they arrive, the same way your own edits are. Two people can edit different elements at once. If a second person starts editing an element someone else is editing, they are told who holds it and their edit is refused until the first person moves on.

An edit that may change more than the element, such as a rule in a global stylesheet or a class that comes from props, is not applied on its own. It shows in your editor with the guest's name and the diff. **Apply** writes it; **Cancel** drops it. The guest sees that it is waiting for you and cannot approve their own edit.

## Review and undo

Every applied guest edit appears in the **Changes** list with the name of the person who made it. **Revert** undoes it like any of your own edits.

## When you go offline

If your editor loses its connection, guests who open the link see that the host is offline instead of the app. When the session is over they see the snapshot of the page taken when you stopped, read only, with the comments and review rounds.
