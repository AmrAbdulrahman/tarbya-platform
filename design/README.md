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

| Token | Value |
|---|---|
| Primary | `#7446F0` (hover `#5A2FD6`, tint `#EFEAFE`) |
| Navy (headings) | `#001447` |
| Page background | `#F0F5FA` |
| Borders | `#D1D5DB`, dividers `#E2E8F0` |
| Trend: improving / worse / steady | `#047857` ↑ / `#B91C1C` ↓ / `#475569` – (always arrow + label, never colour alone) |
| Manager accent | `#0F4C81` on `#E0EEFA` |
| Acting-on-behalf bar | `#78350F` on `#FFFBEB`, border `#B45309` |
| Fonts | IBM Plex Sans Arabic (text), Space Grotesk (numbers), Inter (English) |
| Radius | 4px buttons and inputs, 10px cards |
