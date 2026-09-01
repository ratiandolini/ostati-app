# Supabase Setup

ეს ფოლდერი ამზადებს backend-ის საწყის ბაზას.

მოკლე პრაქტიკული გაშვების სიისთვის ნახე `supabase/RUNBOOK.md`.

## 1. Project

Supabase-ში შექმენი ახალი project.

შემდეგ Project Settings -> API-დან აიღე:

- Project URL
- anon public key

ლოკალურად შექმენი `.env` ფაილი `.env.example`-ის მიხედვით:

```text
REACT_APP_DATA_MODE=api
REACT_APP_AUTH_MODE=email_password
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

ლოკალური demo რეჟიმი მხოლოდ UI-ს სწრაფი ტესტისთვის გამოიყენე. რეალურ Supabase
შემოწმებაზე `REACT_APP_DATA_MODE=api` და `REACT_APP_AUTH_MODE=email_password` უნდა იყოს.

## 2. Database

Supabase SQL Editor-ში ჯერ გაუშვი:

```text
supabase/schema.sql
```

შემდეგ გაუშვი:

```text
supabase/auth.sql
```

შემდეგ გაუშვი:

```text
supabase/seed.sql
```

პროფესიაზე მიბმული ჯავშნის კითხვებისთვის გაუშვი:

```text
supabase/profession_questions.sql
```

ჯავშნის status workflow-ისთვის გაუშვი:

```text
supabase/booking_workflow.sql
```

შეფასებების rating workflow-ისთვის გაუშვი:

```text
supabase/review_workflow.sql
```

ხელოსნის პროფილზე ანონიმური დეტალური შეფასებების გამოსაჩენად გაუშვი:

```text
supabase/public_review_feed.sql
```

გადახდების workflow-ისთვის გაუშვი:

```text
supabase/payment_workflow.sql
```

დავებისა და გაუქმებების workflow-ისთვის გაუშვი:

```text
supabase/dispute_workflow.sql
```

ხელოსნის 30 დღიანი უფასო პერიოდის და თვიური გამოწერის workflow-ისთვის გაუშვი:

```text
supabase/subscription_workflow.sql
```

არსებული და მომავალი ხელოსნების თვიური საფასურის Admin პარამეტრთან სინქრონისთვის გაუშვი:

```text
supabase/subscription_pricing.sql
```

Auth mapping-ის შემდეგ policies ჩართე:

```text
supabase/policies.sql
```

ჯავშნის შექმნის official action-ისთვის გაუშვი:

```text
supabase/booking_actions.sql
```

პროფილის და ვერიფიკაციის action-ებისთვის გაუშვი. ეს ფაილი ამატებს
`users.city` / `users.address_text` ველებსაც, კლიენტის profile load/save RPC-ს,
და ხელოსნის profile response-ში verification status-სა და ატვირთული დოკუმენტების
path-ებს:

```text
supabase/profile_actions.sql
```

თუ ხელოსნის ნომერი არ ინახება, ეს ფაილი ხელახლა გაუშვი და შემდეგ გვერდი განაახლე.

შეფასებების official action-ისთვის გაუშვი:

```text
supabase/review_actions.sql
```

ჩატის official action-ებისთვის გაუშვი:

```text
supabase/message_actions.sql
```

ნოტიფიკაციების official action-ებისთვის გაუშვი:

```text
supabase/notification_actions.sql
```

გადახდის official action-ებისთვის გაუშვი:

```text
supabase/payment_actions.sql
```

დავის official action-ებისთვის გაუშვი:

```text
supabase/dispute_actions.sql
```

ჯავშნების სიის official action-ებისთვის გაუშვი:

```text
supabase/booking_list.sql
```

კლიენტის მხარეს უსაფრთხო ხელოსნების კატალოგისთვის გაუშვი:

```text
supabase/public_catalog.sql
```

Admin launch settings, legal texts, checklist/QA და admin members action-ებისთვის გაუშვი:

```text
supabase/admin_launch_actions.sql
```

Storage bucket-ებისთვის გაუშვი:

```text
supabase/storage.sql
```

თუ profile photo ან პირადობის ატვირთვა ისევ `Unauthorized` / `RLS` შეცდომით წყდება, დამატებით გაუშვი:

```text
supabase/storage_profile_hotfix.sql
```

კლიენტის მოთხოვნის 1-3 ფოტოსა და მოთხოვნის გაუქმებისთვის გაუშვი:

```text
supabase/marketplace_job_post_hotfix.sql
```

თუ ჩატში ჯავშნის საათი UTC-ით, მაგალითად `06:00`-ად ჩანს, გაუშვი:

```text
supabase/message_time_hotfix.sql
```

თუ ძველ Supabase ბაზაზე profile photo, verification documents, Admin settings ან
signed URL-ები ისევ `RLS` / `Unauthorized` / `not found` შეცდომას აჩვენებს, მაშინ
ერთჯერადად გაუშვი:

```text
supabase/hotfix_profile_admin_storage.sql
```

ჯავშნის სტატუსის notification-ების სწრაფი გადამოწმებისთვის გამოიყენე მოკლე
სარემონტო სია:

```text
supabase/STATUS_NOTIFICATION_FLOW.md
```

## 3. RLS

`schema.sql` ჩართავს Row Level Security-ს ყველა მთავარ table-ზე.

`auth.sql` ამატებს trigger-ს `auth.users`-ზე. ახალი Supabase Auth user ავტომატურად
იქმნება/ახლდება `public.users`-ში. თუ metadata-ში role არის `craftsman`, იქმნება
`public.workers` ჩანაწერიც.

`booking_workflow.sql` აკონტროლებს ჯავშნის სტატუსების სწორ მიმდევრობას და status-ის
ცვლილებისას ქმნის notification ჩანაწერებს.

`review_workflow.sql` ამოწმებს, რომ შეფასება მხოლოდ ჯავშნის მონაწილეებმა დაწერონ და
ავტომატურად აახლებს `users.rating_avg` / `users.rating_count` მნიშვნელობებს.

`profession_questions.sql` ამატებს პროფესიის მიხედვით შესავსებ კითხვებს, მაგალითად
მალიარისთვის კვადრატულობა/კედლის მდგომარეობა/მასალა, სანტექნიკოსისთვის
გაჟონვა/მონტაჟი/სართული/ფოტო, ელექტრიკოსისთვის წერტილების რაოდენობა/ფარი/ავარიულობა.

`payment_workflow.sql` ავტომატურად ითვლის აპის საკომისიოს და ხელოსნის წილს. საწყისი
საკომისიო მოდის Admin-ის პლატფორმის პარამეტრებიდან (`commissionPercent`), ხოლო თუ პარამეტრი არ არის შენახული, ნაგულისხმევად გამოიყენება 10%.

`dispute_workflow.sql` დავის გახსნისას ჯავშანს `disputed` სტატუსში გადაიყვანს,
დავის სტატუსის ცვლილებაზე notification-ებს ქმნის და გაუქმებებს audit log-ში ინახავს.

`subscription_workflow.sql` ახალ ხელოსანს ავტომატურად აძლევს 30 დღიან უფასო პერიოდს,
ქმნის `starter` subscription-ს, trial-ის დასრულების შემდეგ status-ს `past_due`-ზე
გადაყავს და trial-ის დასრულებამდე notification-ის ფუნქციას ამატებს. საწყისი თვიური
ფასი მოდის Admin-ის პლატფორმის პარამეტრიდან (`craftsmanMonthlyFee`), ხოლო თუ პარამეტრი
არ არის შენახული, ნაგულისხმევად გამოიყენება 29 GEL.
`run_subscription_maintenance` ერთ action-ად უშვებს expired trial refresh-ს და
trial reminder notification-ების შექმნას.

`policies.sql` ამატებს helper ფუნქციებს და policies-ს იმისთვის, რომ მომხმარებელმა
მხოლოდ თავისი პროფილი, ჯავშნები, მესიჯები, ნოტიფიკაციები და შესაბამისი სამუშაო
მონაცემები ნახოს. `booking_actions.sql` და `profile_actions.sql` იყენებს ამ helper
ფუნქციებს, ამიტომ actions-მდე უნდა გაეშვას.

`booking_actions.sql` ამატებს `create_booking_request` და `update_booking_status_action`
RPC-ებს. კლიენტი ამ action-ით ქმნის ჯავშანს, booking details-ს, booking fee payment
row-ს `authorized` სტატუსით და ხელოსნისთვის ახალ notification-ს ერთ transaction-ში.
status update action კი ამოწმებს, რომ ხელოსანმა მხოლოდ თავისი booking შეცვალოს,
კლიენტმა კი მხოლოდ თავისი დასადასტურებელი/გასაუქმებელი მოქმედება გააკეთოს.
იგივე ფაილი `booking_details` table-ს უმატებს ყველა დამატებით field-ს, რომელსაც
კლიენტი პროფესიის მიხედვით ავსებს.

`booking_worker_change.sql` ამატებს `change_my_booking_worker` RPC-ს. კლიენტს შეუძლია
მოლოდინში მყოფ ან ხელოსნის მიერ უარყოფილ მოთხოვნაზე სხვა, იმავე პროფესიის
ვერიფიცირებული ხელოსანი აირჩიოს. ძველი მოთხოვნა არქივში რჩება, ახალი მოთხოვნა იმავე
დროითა და დეტალებით იქმნება, ხოლო ჩატის ძველი ისტორია ახალ ხელოსანს არ გადაეცემა.
RPC ასევე ამოწმებს დროის კონფლიქტს, გადააბამს MVP payment authorization-ს და ორივე
მხარეს უგზავნის შესაბამის notification-ს.

`profile_actions.sql` ამატებს profile update-ს, ხელოსნის სრული სამუშაო პროფილის
load/save RPC-ებს და verification document upload RPC-ს. ხელოსნის პროფილის save ერთ
transaction-ში აახლებს სახელს, ფოტოს, ქალაქს, აღწერას, პროფესიებს, ფასს, სამუშაო
დღეებს და დაკავებულ პერიოდებს. ფაილები Storage-ში იტვირთება, ხოლო table-ებში
ინახება მხოლოდ path/URL. `get_current_worker_profile` ასევე აბრუნებს verification
status-ს, ატვირთული დოკუმენტების path-ებს და subscription/trial მონაცემებს, რომ
ხელოსნის პანელმა refresh-ის შემდეგაც რეალური ვერიფიკაცია და უფასო პერიოდი აჩვენოს.

`review_actions.sql` ამატებს `create_booking_review` და `list_my_reviewed_booking_ids`
RPC-ებს. კლიენტი ხელოსანს აფასებს, ხელოსანი კლიენტს აფასებს, duplicate შეფასება
backend-ზე იბლოკება, ხოლო rating aggregation-ს ისევ `review_workflow.sql` trigger
აახლებს. იგივე ფაილი ამატებს `client_points` ცხრილს და `get_my_client_points`
RPC-ს; კლიენტს ხელოსნის შეფასების შემდეგ 10 ქულა ერიცხება.

`message_actions.sql` ამატებს `send_booking_message`, `mark_booking_messages_read`,
`list_my_message_threads` და `list_booking_messages` RPC-ებს. ჩატის გაგზავნა,
thread list, unread count, last message და წაკითხულად მონიშვნა backend-ზე კონტროლდება
booking parties უფლებებით. ჩატის ფოტოები ინახება `attachment_url` / `attachment_type`
ველებით და frontend-ში პირდაპირ სურათად ჩანს.

`notification_actions.sql` ამატებს reusable `notify_user` helper-ს და notification
list/count/read-state RPC-ებს. frontend notification list-ს და unread count-ს official
actions-ით კითხულობს, ხოლო read state-ს backend action-ით ცვლის. `notify_user`
გამოიყენება booking/dispute/admin workflow-ებში, რომ title/body/type ერთნაირად
შეიქმნას და null user-ზე insert არ ჩავარდეს.

`payment_actions.sql` ამატებს `capture_booking_payment`, `refund_booking_payment` და
`get_booking_payment_summary` RPC-ებს. MVP-ში ეს manual hold workflow-ია: booking fee,
provider და currency backend platform settings-იდან მოდის, capture/refund audit log-ს
წერს, booking payment status კი `payment_workflow.sql` trigger-ით სინქრონდება.
`payment_workflow.sql` საკომისიოს `platform_settings.platform.commissionPercent`-იდან
კითხულობს და payments row-ზე platform/worker amount-ს ავტომატურად ითვლის.
capture/refund action-ები idempotent არის: უკვე შესრულებულ capture/refund-ზე იგივე
სტატუსს აბრუნებს, ხოლო payment-ის არქონისას `not_required` პასუხს იძლევა.
რეალური ბანკის integration-ისას იგივე actions პროვაიდერის init/callback-ებთან მიებმება.

`dispute_actions.sql` ამატებს `open_booking_dispute` RPC-ს. დავის გახსნა backend-ზე
აკონტროლებს booking party უფლებებს, dispute row-ს ქმნის, კლიენტს/ხელოსანს
საგნობრივ notification-ს უგზავნის და `dispute_workflow.sql` ჯავშანს `disputed`
სტატუსში გადაიყვანს. `dispute_workflow.sql` აღარ აგზავნის insert-ზე დუბლირებულ
notification-ს; Admin RPC-ები კი საკუთარ ზუსტ notification-ს აგზავნიან.

`booking_list.sql` ამატებს `list_my_client_bookings` და `list_my_worker_bookings`
RPC-ებს. კლიენტი იღებს მხოლოდ თავის ჯავშნებს, ხელოსანი კი მხოლოდ თავის incoming/active
საქმეებს. სიაში ბრუნდება cancellation reason და პროფესიის მიხედვით შევსებული სრული
measurement/details მონაცემები, ასევე payment provider/currency/transaction id.

`public_catalog.sql` ქმნის `worker_cards` view-ს, საიდანაც frontend კითხულობს მხოლოდ
კლიენტისთვის უსაფრთხო ხელოსნის ბარათის მონაცემებს. ტელეფონი ამ view-ში საერთოდ არ
გადის.

`admin_launch_actions.sql` ქმნის `platform_settings`, `admin_members` და
`launch_checklist_items` table-ებს, ამატებს RLS policies-ს და official RPC-ებს:
`get_admin_launch_state`, `save_admin_platform_settings`,
`update_admin_member_state`, `update_launch_checklist_item`,
`update_admin_account_status`, `admin_update_booking_action`,
`admin_mark_dispute_reviewing`, `admin_resolve_dispute_action`,
`admin_review_worker_verification`, `list_admin_bookings`, `list_admin_disputes`,
`list_admin_users`, `get_current_admin_context`, `current_admin_has_permission`.
ეს გადახდამდე Admin
settings/legal/checklist/QA/audit ფენას, კლიენტის/ხელოსნის account status action-ებს,
Admin booking close/refund/dispute მოქმედებებს და დავების resolution-ს backend-ზე
გადასაყვანად ამზადებს. იგივე ფაილი Admin verification queue-ს აბრუნებს launch state-ში
და approve/reject action-ით აახლებს ხელოსნის დოკუმენტებს, worker/user status-ს,
notification-ს და audit log-ს. `list_admin_bookings` / `list_admin_disputes` Admin-ს
აბრუნებს ყველა რეალურ ჯავშანს და დავას client/worker/payment/details ინფორმაციით.
`list_admin_users` აბრუნებს კლიენტებს და ხელოსნებს სტატუსით, რეიტინგით,
ვერიფიკაციით და ჯავშნების სტატისტიკით.
`get_current_admin_context` logged-in Admin-ს აბამს კონკრეტულ `admin_members` ჩანაწერზე,
ხოლო `current_admin_has_permission` backend RPC-ებში ამოწმებს კონკრეტულ უფლებებს
(`verification`, `disputes`, `bookings`, `finance`, `users`, `settings`, `audit`).
ფაილი `user_status` enum-ს უმატებს `limited` მნიშვნელობასაც, რომ Admin-მა შეზღუდული
ანგარიშები ცალკე სტატუსად შეინახოს.

მნიშვნელოვანია: `policies.sql` ჩართე `auth.sql`-ის შემდეგ.

## 4. Storage Buckets

`storage.sql` ქმნის bucket-ებს:

- `profile-photos`
- `verification-documents`
- `booking-photos`
- `worker-portfolio`
- `chat-attachments`

API რეჟიმში profile photo, verification documents და chat attachments უკვე storage
helper-ებით იტვირთება. Demo/MVP რეჟიმისთვის `chat-attachments` public-read არის,
რომ ჩატში ატვირთული ფოტო პირდაპირ გამოჩნდეს. ფაილების path user/auth folder-ით
ინახება, მაგალითად:

```text
{auth.uid()}/profile/avatar.webp
{auth.uid()}/verification/id-front.jpg
```

თუ storage bucket-ები მწვანედ ჩანს, მაგრამ კონკრეტული ფოტო Admin-იდან მაინც არ
იხსნება, ჯერ სცადე იგივე მომხმარებლით ახალი სატესტო ფოტოს ატვირთვა. ძველი path-ები
შეიძლება ძველი policy-ით ან სხვა user folder-ით იყოს შენახული.
