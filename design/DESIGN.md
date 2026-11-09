# OR-Nav design system

Feeling: calm, clinical, premium. Reference: Linear and Apple Health. Dark only (OR Dark Mode).
Every screen takes colors, type, spacing and parts from `src/theme.ts`, which mirrors this file. Never hard-code a color, size or font in a screen.

## Colors
| Token | Hex | Use |
| --- | --- | --- |
| bg | #0B0F19 | Screen background |
| surface | #111827 | Cards, list groups, inputs |
| raised | #172033 | Bottom sheet, pressed rows |
| line | #1F2937 | Hairline dividers (1px), card borders |
| accent | #38BDF8 | The one primary action, selection, links |
| accentSoft | #38BDF81F | Accent tint behind icons and chips |
| text | #F8FAFC | Main text |
| text2 | #94A3B8 | Secondary text, labels |
| text3 | #64748B | Hints, placeholder, disabled |
| ok | #4ADE80 | Approved, connected |
| warn | #FBBF24 | Pending review |
| danger | #F87171 | Errors, reject, remove |
Rule: color means something. Accent only for action or selection; warn only for pending; never decoration.

## Type (system font: Roboto on Android, SF on iPhone)
One family, weights 400 / 600 / 700. Numbers use tabular figures.
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
Radius: 12 controls and chips, 16 cards, 28 sheet top corners.
Depth: no drop shadows on dark; use the raised color plus a 1px line.

## Icons
Ionicons from @expo/vector-icons only. Outline style, 22 in rows, 24 in bars; filled only for the selected tab. Icons sit in a 40x40 tile (radius 12, accentSoft). Never emoji as icons (the profile avatar is content, not an icon).

## Motion
Sheets and tabs use a spring (about 300 ms). Lists never animate on scroll. Respect the phone's reduce-motion setting: then fade only.

## Core components
- **Button**: primary 56 high, accent fill, bg-colored text, one per screen. Secondary: 56 high, 1px accent outline. Ghost: text only, 48 high.
- **Input / search**: 52 high, surface fill, radius 12, search icon left, clear button right; 1px accent border on focus.
- **Card**: surface, radius 16, 1px line, padding 16.
- **List row**: at least 64 high; icon tile, title (body 600) + subtitle (callout, text2), status badge, chevron. Rows in a group share one card with hairline dividers inset 68.
- **Top bar**: large title left, at most one icon button right (48x48). Department switcher sits under the title.
- **Bottom sheet** (the preview): slides up over a dimmed screen, tab bar included (bg at 60%). Grab handle, title, content, one primary action at the bottom inside thumb reach. Closes by swipe down, tap on the dim area, the close button, or Android Back. With the keyboard open, it shrinks to sit above it; the title never goes under the status bar.
- **Chip / badge**: chip 40 high (tap area 48), radius 12. Badge 24 high, caption text, tinted fill of its meaning color.
- **Touch feedback**: anything button-like uses `PressScale` (shrinks to 97% while held); list rows tint to raised instead.
- **Item icons**: by category (instrument, suture, implant, drug, drape, else box), from `src/features/library/icons.ts`.
- **Status strip**: scrolling screens keep a solid bg strip behind the status bar.

## States
Every list has: loading (3 grey skeleton rows, no spinner), empty (icon, one sentence, one action), error (sentence in plain words + Try again), offline (thin banner: "Offline — showing your saved copy").

## Sizes (HIG)
Tap targets 48x48 dp minimum with 8 between. Main actions in the lower two-thirds. Destructive actions need a second confirm step.

## Change log
- 2026-11-08: created (calm clinical, Linear / Apple Health, dark only, Ionicons).
- 2026-11-08: whole-app polish (Sean): sign-in, setup questions and Me moved onto the kit; sentence case everywhere. Rule: never change the color of a rounded view in place on Android (it loses its corners); mount a fresh view instead.
