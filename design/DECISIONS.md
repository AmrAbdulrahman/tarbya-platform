# Design decisions

Rules settled while designing Tarbya. Where a rule was my call rather than the brief's, it is marked *(proposed)* and is open to change.

## Language

- Arabic and right-to-left by default; English and left-to-right are supported.
- Each user picks a default language in their profile.

## Roles

Roles come from relationships, not a single "role" field. One person can hold several at once.

| Role | How someone gets it |
|---|---|
| Super admin | Exactly one, configured from environment variables. |
| Moderator | Appointed by the super admin. |
| Mentor | Has at least one mentee assigned. |
| Mentee | Is assigned to a mentor. |
| Group admin | Made admin of a group by a moderator or the current group admin. A group has exactly one. |
| Group moderator | Assigned by a moderator or the group admin. A group can have several. |
| Manager | Has at least one member reporting to them (see below). |

- Someone can be a mentor and a mentee at the same time; the dashboard shows "my mentors" next to "my mentees".
- The sidebar has one section per role the person holds: administration, my team, my mentees, my journey.

## Sign-in

- Email and password, or a one-time code.
- At first only moderators and mentors can sign in.
- Email and phone are both optional on a user.

## Management (manager line)

- Every mentor has a manager. Every manager can have a manager, to any depth.
- People at the top level have no manager.
- The manager line is separate from mentorship: your manager and your mentor are usually different people, and managing someone doesn't make you their mentor.
- A manager sees their whole team, at every level below them, and never anyone above. *(proposed)*
- The team dashboard shows stats for direct reports or for all levels, and can narrow to one member's sub-team.
- A manager can act on behalf of any member below them: log a follow-up, send a reminder, answer an RSVP, reply to a plan report.
- Acting on behalf: *(proposed)*
  - A persistent bar shows whose account you are acting for until you end it.
  - Each action is recorded as "manager on behalf of member" in an audit log that the member, their managers and moderators can see.
  - The member is always notified; notifying the mentee is optional.
- A manager can't read private notes between a mentor and a mentee; those stay with the mentor and moderators. *(proposed)*
- Moderators set each user's direct manager; the users table shows it. There is no form for setting it yet, and it must block cycles.

## Mentoring

- **Follow-up:** date, time, notes, challenges, one-time tasks, and updates to the mentee's development plans.
- **Activity:** an outing, travel, sport or food, for one or more mentees. It is not a follow-up meeting.
- The follow-up and activity screens share a switcher at the top.
- Whether an activity is upcoming or done is worked out from its date and time; nobody sets it by hand. Upcoming activities offer notification options.
- The mentor dashboard shows each mentee's last contact and its type. Contact is marked regular, due, or late (no contact for more than 14 days).

## Development plans

- A plan has a name, an optional end date, a goal and a tracking method (from lookups).
- A plan always shows its trend: improving, worse or steady, with an arrow and a text label as well as the colour.
- Mentees report progress on their plans; the mentor replies in the plan's report history.

## Notes

- Shared notes are visible to the mentee.
- Private notes are visible only to the mentor and moderators.

## Groups

- A mentee can belong to groups, but doesn't have to.
- A group has one or more recurring gatherings (a lesson or study circle, usually weekly).
- Gatherings notify every member and ask them to confirm attendance.
- Each gathering has an attendance log with notes.
- Gatherings appear in each member's history and feed.
- Group moderators manage members, activities and reminders. A group can also have one-time activity types.

## Notifications and messages

- Notifications go in-app and by email; each user chooses which in their profile.
- The sticky header has notification and message buttons with unread badges. Both open the same kind of drop-down, which links to a full screen.

## Profile

- Name, optional email, optional phone, optional picture.
- Language, picture, password, email and phone are all changed inline on the profile screen.
- Changing email or phone takes a verification code: edit → verify → done.

## Admin and lookups

- The super admin and moderators manage lookups (group gathering types, activity types, plan tracking methods) and resources (users, mentoring relations, groups).
- Every place that picks a user uses typeahead search.
