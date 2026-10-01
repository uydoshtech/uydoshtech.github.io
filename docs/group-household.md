# Group household MVP

A household is created by a group owner confirming a shortlisted housing listing
and a calendar move-in date. This records `group_progress.phase = moved_in`.
Recruitment remains independently `recruiting` / `full`; `closed` still takes
precedence and makes household actions read-only. Existing chat and shortlist
records remain intact.

## Rollout

1. Apply backend migration `_0072_group_households.js`.
2. Deploy the backend before publishing the Mini App assets. The group context
   query requires the new household table.
3. Publish through the existing Mini App build-stamping workflow.

No migration or deployment is performed by this source change.

## API

All endpoints are under `/listings/:id/group/home` and require authentication.
Current resident members and the owner can read; landlord guests cannot.

- `GET /`: household, resident members, chores, and viewer permissions.
- `POST /move-in`: owner only; `{housing_listing_id, moved_in_on}`. The housing
  must be in the group shortlist. Confirmation is idempotent and immutable.
- `POST /chores`: `{title, assignee_id, due_on, repeat_days}`. Assignee must be
  a current resident. A repeat interval of zero means a one-off task.
- `POST /chores/:choreId/complete`: `{due_on}`. Assignee or owner only. The
  expected date prevents a duplicate request from completing the next occurrence.

Completion history is retained in `listing_group_chore_completions`. Recurring
chores move to the next active resident in join order; dates advance from the
scheduled date, not from the completion date. An overdue task remains overdue
until each occurrence is completed. Owners can complete tasks assigned to a
resident who subsequently leaves.

The initial interface supports creating and completing chores. Editing/deleting
chores, correcting a confirmed move-in, notifications, purchases, expenses, and
native Flutter household screens are follow-up work, not part of this MVP.
