# Business requirements

Tarbya is a closed mentorship platform for one organisation. People are mentored by a mentor, follow development plans, meet in groups, and sit in a management hierarchy that is separate from mentorship.

IDs (`BR-…`) are stable; user stories in [user-stories.md](user-stories.md) refer to them. **Release** says whether a rule ships in v1 or v2.

## 1. Organisation and locale

| ID       | Requirement                                                                                                                                                      | Release |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-ORG-1 | One organisation per installation. No tenant id anywhere.                                                                                                        | v1      |
| BR-ORG-2 | Arabic and right-to-left by default; English and left-to-right supported. Each user picks a default language.                                                    | v1      |
| BR-ORG-3 | One organisation time zone, `Africa/Cairo`. Times are stored in UTC and shown in the organisation zone. Recurring gatherings repeat in that zone.                | v1      |
| BR-ORG-4 | Dates can be shown in the Gregorian calendar, the Hijri (Umm al-Qura) calendar, or both. Each user picks one in their profile; default is both.                  | v1      |
| BR-ORG-5 | Thresholds (contact "due" and "late" days, reminder timing, trend sensitivity, days before a plan check-in is due) are system settings that moderators can edit. | v1      |

## 2. Users and roles

| ID       | Requirement                                                                                                                                                                                                                                    | Release |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-USR-1 | A user has a name, optional email, optional phone and optional profile picture. Email and phone are unique when present.                                                                                                                       | v1      |
| BR-USR-2 | Users are never hard-deleted. A moderator can deactivate a user: they can't sign in, can't be assigned, and their history stays.                                                                                                               | v1      |
| BR-USR-3 | There is exactly one super admin, defined by environment variables, not stored as an editable user role.                                                                                                                                       | v1      |
| BR-USR-4 | The super admin appoints and removes moderators.                                                                                                                                                                                               | v1      |
| BR-USR-5 | Roles are derived from relationships, not chosen from a list: mentor (has a mentee), mentee (has a mentor), group admin / group moderator (from group membership), manager (has someone reporting to them). One user can hold any combination. | v1      |
| BR-USR-6 | Wherever a user is picked or searched for, the UI offers typeahead by name, email or phone.                                                                                                                                                    | v1      |

## 3. Sign-in

| ID        | Requirement                                                                                                                                                | Release |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-AUTH-1 | Users sign in with email + password or with a one-time code sent by email.                                                                                 | v1      |
| BR-AUTH-2 | Which roles may sign in is a global setting. Default: super admin, moderators and mentors. Opening it to mentees later is a settings change, not a deploy. | v1      |
| BR-AUTH-3 | A user without an email can't sign in (no SMS in v1).                                                                                                      | v1      |
| BR-AUTH-4 | Users who can't sign in receive no notifications.                                                                                                          | v1      |

## 4. Mentorship

| ID       | Requirement                                                                                                                                                     | Release |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-MEN-1 | Moderators create and end mentorships (mentor ↔ mentee).                                                                                                        | v1      |
| BR-MEN-2 | A mentee has exactly one active mentor at a time. A mentor can have many mentees.                                                                               | v1      |
| BR-MEN-3 | A person can be a mentor and a mentee at once, forming a mentoring hierarchy. A user can't mentor themselves or anyone above them in their own mentoring chain. | v1      |
| BR-MEN-4 | Ending a mentorship keeps its history (follow-ups, notes, plans) attached to that mentorship.                                                                   | v1      |

## 5. Follow-ups and activities

| ID      | Requirement                                                                                                                                            | Release |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| BR-FU-1 | A mentor logs a **follow-up** with one mentee: date, time, notes, challenges, one-time tasks, and updates to the mentee's development plans.           | v1      |
| BR-FU-2 | A mentor logs an **activity** (outing, travel, sport, food — types are lookups) with one or more participants. Any active user can be a participant.   | v1      |
| BR-FU-3 | Whether a follow-up or activity is upcoming or done is derived from its date and time; nobody sets it. Upcoming items can notify participants.         | v1      |
| BR-FU-4 | One-time tasks have a title, optional due date and done state; the mentee can tick them off.                                                           | v1      |
| BR-FU-5 | Each mentee's last contact (latest done follow-up or activity) drives a status: regular, due (≥ due days), late (≥ late days). Defaults 7 and 14 days. | v1      |

## 6. Development plans

| ID        | Requirement                                                                                                      | Release |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| BR-PLAN-1 | A plan belongs to a mentee: name, goal, optional end date, tracking method (lookup), and a target.               | v1      |
| BR-PLAN-2 | Only the mentor and moderators create, edit, close or reopen plans.                                              | v1      |
| BR-PLAN-3 | Progress readings come from mentor follow-ups and from mentee check-ins.                                         | v1      |
| BR-PLAN-4 | Every plan shows its trend: improving, worse or steady, always with an arrow and a text label, not colour alone. | v1      |
| BR-PLAN-5 | The mentor can reply to a mentee's check-in; replies show in the plan's report history.                          | v1      |

## 7. Notes

| ID        | Requirement                                                                                                                                                                                          | Release |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-NOTE-1 | Notes on a mentee are either **shared** (mentee, mentor and moderators see them) or **private** (mentor and moderators only).                                                                        | v1      |
| BR-NOTE-2 | Managers never see private notes, including in acting-on-behalf.                                                                                                                                     | v2      |
| BR-NOTE-3 | Admin notes on a user are read and written by everyone above them in the management chain, their current mentor, and moderators or the super admin; never by the user. Only the author edits a note. | v1      |

## 8. Groups

| ID        | Requirement                                                                                                                                                                                             | Release |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-GRP-1  | Moderators create groups and assign exactly one group admin.                                                                                                                                            | v1      |
| BR-GRP-2  | The group admin can hand over the admin role and add or remove group moderators. Moderators can also do this.                                                                                           | v1      |
| BR-GRP-3  | Members are the group admin, group moderators and mentees. A mentee must have an active mentor to join a group. A mentee can be in several groups or none.                                              | v1      |
| BR-GRP-4  | The group admin's whole manager chain can see the group, its gatherings and attendance. They are not members, aren't counted, and aren't asked to RSVP. This is derived from the hierarchy, not stored. | v1      |
| BR-GRP-5  | A group has one or more recurring gatherings (usually weekly): type (lookup, e.g. lesson, study circle), day, time, place.                                                                              | v1      |
| BR-GRP-6  | Group admins and moderators can add one-time group activities with group-specific activity types.                                                                                                       | v1      |
| BR-GRP-7  | Before each gathering, members are notified and asked to confirm attendance (attending / not attending).                                                                                                | v1      |
| BR-GRP-8  | Group admins and moderators keep an attendance log per gathering with per-member notes.                                                                                                                 | v1      |
| BR-GRP-9  | Gatherings and attendance appear in each member's history and feed.                                                                                                                                     | v1      |
| BR-GRP-10 | Group admins and moderators manage members, gatherings and reminders.                                                                                                                                   | v1      |

## 9. Management hierarchy

| ID       | Requirement                                                                                                                                                                                                                                                              | Release                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| BR-MGR-1 | Only moderators sit in the management line: each moderator can have one direct manager, who is a moderator or the super admin. Top-level moderators have none. A moderator who still manages others can't stop being a moderator; one who stops loses their own manager. | v1                             |
| BR-MGR-2 | The hierarchy is recursive and must never contain a cycle.                                                                                                                                                                                                               | v1                             |
| BR-MGR-3 | Moderators and the super admin set any user's manager. A manager can move members within their own subtree.                                                                                                                                                              | v1 (moderators), v2 (managers) |
| BR-MGR-4 | Management is separate from mentorship: being someone's manager doesn't make you their mentor or give mentoring rights.                                                                                                                                                  | v1                             |
| BR-MGR-5 | A manager sees their whole subtree at every level below them, and never anyone above.                                                                                                                                                                                    | v2                             |
| BR-MGR-6 | A team dashboard shows stats for direct reports or for all levels, and can narrow to one member's sub-team.                                                                                                                                                              | v2                             |
| BR-MGR-7 | A manager can act on behalf of anyone in their subtree: log a follow-up, send a reminder, answer an RSVP, reply to a plan report.                                                                                                                                        | v2                             |
| BR-MGR-8 | Acting on behalf is always visible (persistent banner), recorded as "manager on behalf of member" in an audit log visible to the member, their managers and moderators, and always notifies the member.                                                                  | v2                             |

## 10. Notifications and messages

| ID       | Requirement                                                                                                                                                                                                                                                                                  | Release |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-NTF-1 | Notifications are delivered in-app and by email. Users pick channels per notification type; some types are mandatory.                                                                                                                                                                        | v1      |
| BR-NTF-2 | New notifications and messages appear without a page reload.                                                                                                                                                                                                                                 | v1      |
| BR-NTF-3 | Notification types in v1: mentorship assigned/ended, follow-up or activity scheduled/changed, contact due/late (to mentor), gathering RSVP request and reminder, plan created/changed, check-in due (to mentee), check-in submitted (to mentor), mentor replied, task assigned, new message. | v1      |
| BR-MSG-1 | Mentor ↔ mentee one-to-one conversations.                                                                                                                                                                                                                                                    | v1      |
| BR-MSG-2 | One conversation per group; members can post.                                                                                                                                                                                                                                                | v1      |
| BR-MSG-3 | Manager ↔ member conversations within the manager's subtree.                                                                                                                                                                                                                                 | v2      |

## 11. Administration and lookups

| ID       | Requirement                                                                                                                                                                         | Release |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| BR-ADM-1 | The super admin and moderators manage users, mentorships, groups and managers.                                                                                                      | v1      |
| BR-ADM-2 | They manage lookups: group gathering types, activity types, plan tracking methods. Lookups have Arabic and English names, can be deactivated, and are never hard-deleted once used. | v1      |
| BR-ADM-3 | They manage system settings (BR-ORG-5, BR-AUTH-2).                                                                                                                                  | v1      |
| BR-ADM-4 | Sensitive changes (roles, mentorships, managers, deactivation, settings) are written to an audit log.                                                                               | v1      |

## Open questions

- Trend rule: built as "average of the last 3 readings vs the 3 before, within 5% of the plan's scale counts as steady", tunable in settings, with each plan saying whether higher or lower is better. Confirm with real plans.
- Should ending a mentorship close the mentee's open plans, or carry them over to the next mentor? For now plans belong to the mentee and carry over untouched.
- Do group gatherings count as "contact" for a mentor's last-contact status when the mentor attends?
