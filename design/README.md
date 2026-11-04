# Design snapshot

A snapshot of the Tarbya design canvas, exported on 2026-11-01 (canvas version 22).

- Live canvas (view and comment): https://claude.ai/artifact/RfzuonviXYXQT9qwSeSuKX
- `screens/*.dc.html`: one file per screen. Read them for layout, Arabic copy, colours and the shape of each screen's data (in the `renderVals()` script at the bottom).
- `canvas.json`: board positions and titles. It names the screens without the `screens/` folder.
- [DECISIONS.md](DECISIONS.md): the product rules settled during design.

These files are reference, not app code. They need a `support.js` that only the canvas provides, so they don't render when opened locally. When the canvas changes, export it again and commit the diff.

## Screens

| Row | Screen | File |
|---|---|---|
| Mentor flow | Mentor dashboard | `Main.dc.html` |
| | Mentee profile and plans | `Mentee.dc.html` |
| | New follow-up | `FollowUp.dc.html` |
| | New activity | `Activity.dc.html` |
| My journey | Home as a mentee | `MyJourney.dc.html` |
| | My plan and check-in | `MyPlan.dc.html` |
| Groups and admin | Group and attendance | `Group.dc.html` |
| | Moderator console | `Admin.dc.html` |
| | Activity types | `ActivityTypes.dc.html` |
| | Login | `Login.dc.html` |
| Profile and inbox | Profile and settings | `Profile.dc.html` |
| | Notifications | `Notifications.dc.html` |
| | Messages | `Messages.dc.html` |
| Management | Team dashboard | `Team.dc.html` |
| | Act on behalf | `OnBehalf.dc.html` |

## Visual tokens

Brand sheet: [brand/brand-sheet.webp](brand/brand-sheet.webp). Tokens live in `libs/ui/src/styles/theme.css`; the logo mark is `apps/web/src/components/logo.tsx` (also `apps/web/public/logo.svg`), and the favicon and app icons are in `apps/web/public/`. The screen snapshots predate the brand and still show the old purple and navy; where they differ, these tokens win.

| Token | Value |
|---|---|
| Primary / brand (headings, key actions) | `#0E4D3A` (hover `#0A3B2C`, tint `#E3EFE9`) |
| Secondary (UI elements, highlights) | `#2F6B57` |
| Accent (gold: emphasis, "new" trend) | `#D7A84A` (tint `#F8EED8`, text on tint `#75560F`) |
| Sand (sections) | `#F5E8D1` |
| Page background | `#FAF8F2`; cards `#FFFFFF` |
| Borders | `#DDD6C6`, dividers `#ECE6D8` |
| Trend: improving / worse / steady | `#047857` ↑ / `#B91C1C` ↓ / `#475569` – (always arrow + label, never colour alone) |
| Manager accent | `#0F4C81` on `#E0EEFA` |
| Acting-on-behalf bar | `#78350F` on `#FFFBEB`, border `#B45309` |
| Fonts | Manrope (English and numbers), Tajawal (Arabic) |
| Radius | 4px buttons and inputs, 10px cards |
