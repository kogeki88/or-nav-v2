# One-screen redesign: decisions (Sean, 2026-11-10)

Agreed in a grilling session. Next: picture (`mockups/one-screen.html`) → Sean approves the look → spec + tickets → build layout → Brick 4 (cards + Scrub Mode) inside it.

## Who it is for
A nurse mid-case, gloved or rushed. Simplicity wins over features on the main screen.

## Main screen
- Clean, like AI chat apps. No bottom tabs.
- One box at the bottom (thumb reach).
- Empty case shows the 3 most recent cases.
- On open: back into the last case if it was used in the last 4 hours; otherwise a new case.

## The one box (replaces Library search + "Ask OR-Nav" bar)
- No guessing between "item" and "question" (the old bug: questions came back as "item not found").
- While typing: matching items and cards show at once, offline, sound-alike spelling.
- Send always goes to the AI. Its answer can hold tappable items and cards.
- Offline Send: "The AI needs internet"; matches stay on screen.

## Cases
- A case is tied to a surgeon, a procedure and that procedure's preference card (cards already store surgeon + procedure).
- The app never asks. The case learns quietly: opening a card sets it; typing "Lee's CABG" sets it.
- A small label at the top shows it ("Dr. Lee · CABG"); tap to change; no pop-ups. Unknown → named by time ("Case 7:42").
- The AI always gets the case label as context.
- Saved on the phone only; last 20 cases kept.

## Sidebar (☰ top left, or swipe from the left edge)
Top to bottom: New case, Library, To review (only when something waits, with a count), recent cases, first-name button.
- ☰ shows a small dot when To review has something waiting.

## First-name button
- Department (set once, rarely changed).
- Settings. Regular nurse: Check for updates, Sign out. Admins also: Admin view, full check, fault log, questionnaire preview.

## Opening things
- Card → full screen Scrub Mode: big type, swipe through phases, back arrow.
- Item → today's small bottom sheet.

## Later (not now)
- A question board where nurses post questions to each other.
