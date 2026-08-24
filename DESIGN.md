# Habits Design System

This file is the authoritative visual reference for the Habits app. The theme adapts the supplied Treat Tab candy palette to the existing phone-first habit, routine, task, journal, and settings experience.

## Direction

The interface combines a playful sweetshop palette with high-contrast neo-brutalist structure. It should feel energetic and approachable while remaining clear enough for daily check-ins, dated tasks, historical edits, recovery warnings, and destructive actions.

## Core palette

| Token | Color | Hex | Usage |
| --- | --- | --- | --- |
| `--brand-pink` | Bubblegum Pink | `#FFD8E8` | App canvas and the primary visual identity |
| `--brand-black` | Solid Black | `#000000` | Heavy borders, offset shadows, navigation, and headings |
| `--brand-white` | Pure White | `#FFFFFF` | Cards, modals, sheets, and clear content surfaces |
| `--brand-cyan` | Pastel Cyan | `#9BE9FB` | Primary actions, active states, progress, and highlights |
| `--brand-cyan-hover` | Soft Cyan | `#83DFEF` | Hover and pressed states |
| `--brand-lilac` | Pastel Lilac | `#FAE8FF` | Secondary actions and gentle prompts |
| `--brand-ice` | Soft Ice Blue | `#EBF8FF` | Selected controls and quiet highlights |
| `--brand-rose` | Candy Rose | `#F6BED5` | Pink borders and supporting accents |
| `--brand-danger` | Danger Red | `#CC0000` | Overdue, recovery, and destructive actions |
| `--brand-danger-bright` | Crimson | `#E02424` | Critical alerts and strong destructive states |
| `--brand-off-white` | Off-White | `#FBFBFB` | Inputs and quiet card interiors |
| `--brand-neutral` | Neutral Light | `#F1F1F1` | Dividers and disabled surfaces |

## Functional colors

- Success and positive completion: emerald (`#10B981` and accessible lighter/darker variants).
- Overdue or destructive: danger red, always paired with text or an icon.
- Reminders and notices: amber/yellow.
- Categories and secondary badges: violet/purple.
- Trading remains an optional routine and does not receive a global theme or navigation treatment.

## Typography

- Body: `Space Grotesk`, with `Outfit` and system sans-serif fallbacks.
- Display headings: `Outfit`, sans-serif.
- Progress percentages, streaks, dates, and other changing numbers: monospace with tabular numerals.

## Neo-brutalist structure

- Standard cards and controls use `2px` solid black borders.
- Major frames and sheets may use `4px` solid black borders.
- Shadows use solid, zero-blur black offsets:
  - Small: `2px 2px 0 #000000`
  - Standard: `4px 4px 0 #000000`
  - Large: `8px 8px 0 #000000`
- Hover moves an interactive surface slightly up and left while increasing its shadow.
- Pressed controls move back toward their shadow.

## Component rules

- Primary actions: cyan surface, black text, black border, solid offset shadow.
- Secondary actions: lilac or white surface with black structure.
- Cards and sheets: white by default; pink is primarily the canvas.
- Completed routine steps: cyan check surface with black check and border.
- Danger actions: red text or surface with an explicit label and confirmation where data may be removed.
- Historical editing and recovery states must remain visually distinct and must never be hidden by decorative color.

## Accessibility

- Never use color as the only status signal.
- Keep default text black on pastel surfaces and white on black surfaces.
- Icon-only controls require accessible names.
- Use the black focus outline with a cyan offset ring.
- Keep mobile tap targets at least `44px` where layout permits.
- Respect reduced-motion preferences.
- The automatic dark appearance retains the candy accents while using dark surfaces and light text.

