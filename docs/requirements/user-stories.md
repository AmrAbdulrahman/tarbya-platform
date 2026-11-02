# User stories

Grouped by epic. Each story names the business requirements it serves and the design screen it follows (in `design/screens/`). Acceptance criteria are the minimum for "done".

Release tags: **v1** ships first; **v2** comes with the management release.

---

## E1. Sign-in and session

### US-1.1 Sign in with password — v1

As a user allowed to sign in, I want to sign in with my email and password, so that I can reach my dashboard.

- Wrong email or password shows one generic error.
- Users whose role isn't allowed by the sign-in setting are refused with a clear message.
- Deactivated users are refused.
- After sign-in I land on the home for my strongest role (dashboard for mentors, console for moderators).
- Refs: BR-AUTH-1, BR-AUTH-2 · `Login.dc.html`

### US-1.2 Sign in with a one-time code — v1

As a user, I want a code by email instead of a password, so that I can sign in without remembering one.

- Code is 6 digits, valid 10 minutes, single use, max 5 attempts.
- Requests are rate-limited per email and per IP.
- The response is the same whether the email exists or not.
- Refs: BR-AUTH-1, BR-AUTH-3 · `Login.dc.html`

### US-1.3 Stay signed in and sign out — v1

As a user, I want to stay signed in across visits and sign out from any device.

- Short-lived access token and rotating refresh token, both in httpOnly cookies.
- Reusing an old refresh token revokes that whole session.
- Sign out revokes the session; "sign out everywhere" revokes all of mine.

### US-1.4 Switch language — v1

As a user, I want to switch between Arabic and English on the sign-in screen and in my profile.

- Direction flips (RTL/LTR) with the language, without a reload.
- Refs: BR-ORG-2 · `Login.dc.html`, `Profile.dc.html`

---

## E2. Profile and preferences

### US-2.1 Edit my profile — v1

As a user, I want to change my name, picture, language and calendar, so that the app fits me.

- Picture upload accepts JPEG/PNG/WebP up to 5 MB, is resized server-side, and can be removed.
- Calendar choice: Gregorian, Hijri, or both.
- Refs: BR-USR-1, BR-ORG-4 · `Profile.dc.html`

### US-2.2 Change email or phone with verification — v1

As a user, I want to change my email or phone inline, confirming with a code, so that my contact details are really mine.

- Flow: edit → code sent → verify → done, inline on the profile screen.
- Uniqueness is checked before a code is sent.
- Refs: BR-USR-1 · `Profile.dc.html`

### US-2.3 Change password — v1

- Requires the current password (or a fresh one-time code if none is set).
- Shows a strength meter; minimum 10 characters.
- Other sessions are signed out.

### US-2.4 Choose my notifications — v1

As a user, I want to choose in-app and email per notification type.

- Mandatory types show as locked on.
- Refs: BR-NTF-1 · `Profile.dc.html`

---

## E3. Administration

### US-3.1 Manage users — v1

As a moderator, I want to add, edit, search and deactivate users.

- Email and phone are optional and unique when present.
- The list shows roles (derived), direct manager, contact details and whether the user can sign in.
- Refs: BR-USR-1, BR-USR-2, BR-USR-6 · `Admin.dc.html`

### US-3.2 Appoint moderators — v1

As the super admin, I want to make a user a moderator or remove them.

- Refs: BR-USR-4

### US-3.3 Assign and end mentorships — v1

As a moderator, I want to assign a mentee to a mentor with typeahead, and end a mentorship.

- Assigning someone who already has an active mentor asks, in a confirmation dialog, before moving them.
- Each person in the tree has an in-place "add mentee" typeahead.
- Cycles in the mentoring chain are refused.
- Both people are notified.
- The mentoring hierarchy is shown as a tree.
- Refs: BR-MEN-1…4 · `Admin.dc.html`

### US-3.4 Set a user's manager — v1

As a moderator, I want to set or clear a moderator's direct manager with typeahead.

- The manager field only appears for moderators, and only offers moderators and the super admin.
- A choice that would create a cycle is refused.
- Refs: BR-MGR-1…3

### US-3.7 Keep admin notes on a member — v1

As someone who manages or mentors a member (or a moderator), I want to keep notes on their profile that the member never sees.

- Notes show on the member's profile page, newest first, with author and date.
- Only the author edits a note.
- Refs: BR-NOTE-3

### US-3.5 Manage lookups — v1

As a moderator, I want to manage activity types, gathering types and plan tracking methods.

- Arabic and English names; active flag; colour for activity types; scope (individual or group).
- Used values can't be deleted, only deactivated.
- Refs: BR-ADM-2 · `ActivityTypes.dc.html`, `Admin.dc.html`

### US-3.6 Manage system settings — v1

As a moderator, I want to edit thresholds and which roles can sign in.

- Changes are audited.
- Refs: BR-ORG-5, BR-AUTH-2, BR-ADM-3, BR-ADM-4

---

## E4. Mentor workspace

### US-4.1 Mentor dashboard — v1

As a mentor, I want to see all my mentees at a glance, so that I know who needs me.

- Headline numbers: mentees, needing contact, follow-ups this month, plans improving.
- Table: last contact with status (regular / due / late) and type, main plan, trend sparkline with label.
- Filters: all, needs contact, plans worsening.
- Side panels: upcoming items, my mentor, latest notifications.
- Refs: BR-FU-5, BR-PLAN-4 · `Main.dc.html`

### US-4.2 Mentee profile — v1

As a mentor, I want a mentee's full picture: plans with trend charts, timeline, notes and tasks.

- Refs: BR-PLAN-4, BR-NOTE-1 · `Mentee.dc.html`

### US-4.3 Log a follow-up — v1

As a mentor, I want to record a follow-up with date, time, notes, challenges, one-time tasks and plan updates.

- Plan updates add readings to the mentee's plans.
- A future date makes it upcoming and offers notifying the mentee.
- Refs: BR-FU-1, BR-FU-3, BR-FU-4 · `FollowUp.dc.html`

### US-4.4 Log an activity — v1

As a mentor, I want to record an outing, trip, sport or meal with one or more people.

- Participant typeahead covers any active user.
- Upcoming or done is derived from date and time.
- Done activities appear in each participant's feed.
- Refs: BR-FU-2, BR-FU-3 · `Activity.dc.html`

### US-4.5 Create and manage a development plan — v1

As a mentor, I want to create, edit, close and reopen a mentee's plan.

- Fields: name, goal, tracking method, target, optional end date.
- Refs: BR-PLAN-1, BR-PLAN-2 · `Mentee.dc.html` (create-plan entry point; form still to be designed)

### US-4.6 Write notes — v1

As a mentor, I want to write shared or private notes on a mentee.

- Visibility can't be widened after saving without confirmation.
- Refs: BR-NOTE-1 · `Mentee.dc.html`

### US-4.7 Reply to a check-in — v1

As a mentor, I want to reply to a mentee's plan check-in, and be notified when one arrives.

- Refs: BR-PLAN-5 · `MyPlan.dc.html`

---

## E5. Mentee self-service

### US-5.1 My journey — v1

As a mentee, I want a home with my actions, upcoming events, my plans and my feed.

- Actions: open tasks, due check-ins, pending RSVPs; I can mark tasks done here.
- Refs: BR-FU-4, BR-GRP-9 · `MyJourney.dc.html`

### US-5.2 Report progress on a plan — v1

As a mentee, I want to submit a check-in (value + note) and see the trend update.

- History shows my check-ins and my mentor's replies.
- Refs: BR-PLAN-3, BR-PLAN-5 · `MyPlan.dc.html`

### US-5.3 See my mentor and shared notes — v1

- Private notes are never returned to the mentee by the API.
- Refs: BR-NOTE-1

---

## E6. Groups

### US-6.1 Create a group — v1

As a moderator, I want to create a group and assign its admin.

- Refs: BR-GRP-1 · `Group.dc.html`

### US-6.2 Manage group roles and members — v1

As a group admin or moderator, I want to add or remove members and group moderators, and hand over the admin role.

- Only mentees with an active mentor can be added as members.
- Refs: BR-GRP-2, BR-GRP-3, BR-GRP-10

### US-6.3 Schedule recurring gatherings — v1

As a group admin or moderator, I want to define weekly gatherings (type, day, time, place) and edit or cancel single occurrences.

- Refs: BR-GRP-5

### US-6.4 One-time group activity — v1

As a group admin or moderator, I want to add a one-off activity with a group-specific type.

- Refs: BR-GRP-6 · `ActivityTypes.dc.html`

### US-6.5 RSVP — v1

As a group member, I want to be reminded and confirm whether I'll attend.

- The reminder goes out at the configured lead time.
- Members who haven't replied get one follow-up reminder.
- Refs: BR-GRP-7

### US-6.6 Take attendance — v1

As a group admin or moderator, I want to mark who attended and add notes per member.

- The list is pre-filled from RSVPs.
- Refs: BR-GRP-8 · `Group.dc.html`

### US-6.7 Manager chain sees the group — v1

As a manager above a group admin, I want read-only access to the group, its gatherings and attendance.

- I'm not listed as a member and get no RSVP requests.
- Refs: BR-GRP-4

---

## E7. Notifications and messages

### US-7.1 Notification centre — v1

As a user, I want a bell in the header with an unread count, a drop-down of recent items, and a full screen with filters.

- Filters: all, unread, my mentees, my journey, groups.
- Mark one or all as read; inline actions (e.g. RSVP) where relevant.
- New items arrive live.
- Refs: BR-NTF-1…3 · `Notifications.dc.html`, `Main.dc.html`

### US-7.2 Emails — v1

As a user, I get emails for the types I enabled, in my language, with a link into the app.

- Refs: BR-NTF-1

### US-7.3 Messages — v1

As a mentor or mentee, I want one-to-one conversations with my mentor or mentee, and a conversation per group I belong to.

- Header drop-down like notifications; full screen with list and thread; unread counts; live delivery.
- Refs: BR-MSG-1, BR-MSG-2 · `Messages.dc.html`

---

## E8. Management (v2)

### US-8.1 Team dashboard — v2

As a manager, I want stats about my team, for direct reports or all levels, and a tree to narrow to one sub-team.

- Refs: BR-MGR-5, BR-MGR-6 · `Team.dc.html`

### US-8.2 Act on behalf — v2

As a manager, I want to act for a member below me (log a follow-up, send a reminder, RSVP, reply to a report).

- A persistent banner shows who I'm acting for.
- Every action is audited as "manager on behalf of member" and notifies the member.
- Private notes stay hidden.
- Refs: BR-MGR-7, BR-MGR-8, BR-NOTE-2 · `OnBehalf.dc.html`

### US-8.3 Reorganise my subtree — v2

As a manager, I want to move members within my subtree.

- Refs: BR-MGR-3

### US-8.4 Message my team — v2

- Refs: BR-MSG-3
