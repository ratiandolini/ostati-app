# Status and notification flow SQL

Run these SQL files in Supabase when booking status notifications do not appear,
or after changing booking status / notification logic.

Recommended order:

1. `supabase/notification_actions.sql`
2. `supabase/message_actions.sql`
3. `supabase/booking_workflow.sql`
4. `supabase/booking_actions.sql`
5. `supabase/booking_list.sql`

Expected behavior:

- Status changes create notifications for the client and the craftsman.
- Status changes do not create chat messages.
- Chat remains for direct user messages and problem/dispute conversation.
- `worker_completed` creates a review notification for the client.
- `en_route` creates the client notification `ხელოსანი გზაშია`.

