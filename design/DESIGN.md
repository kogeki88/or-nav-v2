# OR-Nav design system

Feeling: calm, quiet, alive. Near-black, no boxes or borders around lists, more space, thin line icons. Dark only (OR Dark Mode). Approved picture: `design/mockups/one-screen.html` (version 3).
Every screen takes colors, type, spacing and parts from `src/theme.ts`, which mirrors this file. Never hard-code a color, size or font in a screen.

## Colors (version 3)
| Token | Hex | Use |
| --- | --- | --- |
| bg | #121314 | Screen background |
| fill | #1C1D20 | The box, inputs, the case label, pressed rows |
| fill2 | #26272B | Bottom sheet, raised things |
| hairline | #2A2B2F | Hairline dividers, only where rows need separating |
| text | #ECECEE | Main text |
| text2 | #A1A2A8 | Secondary text, labels |
| text3 | #6E6F75 | Hints, placeholder, disabled |
| accent | #7DD3B8 | Scrub green: the main action only |
| onAccent | #0E2A22 | Text and icons on the green |
| warn | #E9B65A | Waiting for review, Hold |
| danger | #F08A80 | Errors, reject, remove |
Rules: one quiet green, only for the main action. Yellow only for waiting or Hold. Color always means something; never decoration.
Older names in `theme.ts` (surface, raised, line, ok) point at these colors so older screens keep working.

## Type
Planned: Manrope 400 / 500 / 600 / 700, bundled in `assets/fonts` and loaded with `expo-font`; numbers use tabular figures. Until the font files are added, the system font (Roboto on Android) is used.
| Style | Size / line | Weight |
| --- | --- | --- |
| largeTitle | 32 / 38 | 700 |
| title | 24 / 30 | 700 |
| headline | 19 / 24 | 600 |
| body | 17 / 24 | 400 |
| callout | 16 / 22 | 400 |
| caption | 13 / 18 | 600, uppercase, letter-spacing 0.6 (section labels only) |
Never below 13. Text must grow with the phone's font setting without clipping.

## Spacing and shape
Spacing: 4, 8, 12, 16, 24, 32. Screen side margin 16. Gap between groups 24.
Radius: 12 controls and chips, 16 cards, 28 sheet top corners. Rounded shapes only for the box, the case label, buttons and sheets.
Lists are plain rows with no card and no border; a hairline only where rows need separating.
Depth: no drop shadows on dark; use fill2.

## Icons
Feather from @expo/vector-icons only (thin line icons). 22 in rows, 24 in bars. No tinted square behind icons: the icon sits alone in a 40x40 space so rows line up. Never emoji as icons (the profile avatar is content, not an icon).

## Motion
Sheets and tabs use a spring (about 300 ms). Lists never animate on scroll. Respect the phone's reduce-motion setting: then fade only.

## Core components
- **Button**: primary 56 high, accent fill, bg-colored text, one per screen. Secondary: 56 high, 1px accent outline. Ghost: text only, 48 high.
- **Input / search**: 52 high, surface fill, radius 12, search icon left, clear button right; 1px accent border on focus.
- **Card**: surface, radius 16, 1px line, padding 16.
- **List row**: at least 64 high; icon, title (body 600) + subtitle (callout, text2), status badge, chevron. Rows in a group are plain lines on the background with hairline dividers inset 68.
- **Top bar**: large title left, at most one icon button right (48x48). Department switcher sits under the title.
- **Bottom sheet** (the preview): slides up over a dimmed screen, tab bar included (bg at 60%). Grab handle, title, content, one primary action at the bottom inside thumb reach. Closes by swipe down, tap on the dim area, the close button, or Android Back. With the keyboard open, it shrinks to sit above it; the title never goes under the status bar.
- **Chip / badge**: chip 40 high (tap area 48), radius 12. Badge 24 high, caption text, tinted fill of its meaning color.
- **Touch feedback**: anything button-like uses `PressScale` (shrinks to 97% while held); list rows tint to fill instead.
- **Item icons**: by category (instrument, suture, implant, drug, drape, else box), from `src/features/library/icons.ts`.
- **Status strip**: scrolling screens keep a solid bg strip behind the status bar.

## States
Every list has: loading (3 grey skeleton rows, no spinner), empty (icon, one sentence, one action), error (sentence in plain words + Try again), offline (thin banner: "Offline — showing your saved copy").

## Sizes (HIG)
Tap targets 48x48 dp minimum with 8 between. Main actions in the lower two-thirds. Destructive actions need a second confirm step.

## Change log
- 2026-11-08: created (calm clinical, Linear / Apple Health, dark only, Ionicons).
- 2026-11-08: whole-app polish (Sean): sign-in, setup questions and Me moved onto the kit; sentence case everywhere. Rule: never change the color of a rounded view in place on Android (it loses its corners); mount a fresh view instead.
- 2026-11-10: version 3 look (spec #10, ticket #11): calm, quiet, alive; new colors; Feather icons; plain rows with no card or border; icon tiles lose their square. Manrope waits for the font files.
