# API Service Plan

ეს გეგმა აღწერს, როგორ უნდა ჩანაცვლდეს `src/services/appStorage.ts` რეალური
backend/API service-ით. იდეა ასეთია: ეკრანებმა მაქსიმალურად იგივე ფუნქციები
გამოიძახონ, მაგრამ შიგნით localStorage-ის ნაცვლად Supabase/custom API იმუშაოს.

## რეკომენდებული მიმართულება

საწყისად ჯობს გაკეთდეს ახალი ფაილი:

`src/services/apiService.ts`

შემდეგ კი დროებით გვქონდეს ორი რეჟიმი:

- `appStorage` - demo/local რეჟიმი
- `apiService` - real/backend რეჟიმი

ეს მოგვცემს საშუალებას, demo ვერსია არ გავაფუჭოთ, სანამ backend ბოლომდე არ იქნება მზად.

## Supabase REST Helper

დაემატა `src/services/supabaseConfig.ts` და `src/services/supabaseRest.ts`.
REST helper SDK-ის გარეშე იყენებს Supabase REST endpoint-ს და ამოწმებს `.env`
კონფიგურაციას:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

helper-ს აქვს საწყისი `select`, `insert`, `update`, `remove`, `rpc` მეთოდები. თუ
მომხმარებელი Supabase Auth session-ით არის შესული, მოთხოვნები access token-ით იგზავნება;
თუ session არ არის, fallback არის anon key. ეკრანები ჯერ ამაზე სრულად არ გადადის,
რადგან არსებული `dataService` contract სინქრონულია, Supabase-ის მოთხოვნები კი async
იქნება. შემდეგი frontend migration უნდა იყოს `dataService` method-ების ეტაპობრივად
async-ზე გადაყვანა.

## Auth

### მიმდინარე მდგომარეობა

demo რეჟიმში აპი ტელეფონის ნომერს browser-ში იმახსოვრებს:

- `rememberPhone(role, phone)`
- `getRememberedPhone(role)`

API რეჟიმში Auth უკვე Supabase email/password session-ზე მუშაობს:

- `signInOrSignUpWithEmail(email, password, role)` ქმნის ან შედის მომხმარებელში
- `loadCurrentUserProfile()` session-ის მიხედვით აბრუნებს რეალურ role/status-ს
- `refreshSupabaseSession()` refresh-ზე session-ს აღადგენს
- `signOutSupabase()` logout-ისას Supabase session-ს და local session cache-ს ასუფთავებს

### backend-ზე გადასვლისას

| მოქმედება | backend ლოგიკა |
| --- | --- |
| ელ.ფოსტის შეყვანა | Supabase Auth user-ის login/signup |
| როლის არჩევა | signup metadata -> `users.role`, შემდეგ backend profile-ით დადასტურება |
| ავტორიზაცია | email/password session |
| remembered phone | session/token, არა localStorage |

MVP-ში email/password საკმარისია. Production-მდე საბოლოოდ უნდა გადაწყდეს დაემატება თუ
არა Apple/Google/Facebook login ან SMS provider. ტელეფონის ნომერი ამ ეტაპზე პროფილის
მონაცემად რჩება და არ გამოიყენება Supabase SMS OTP-სთვის.

დაემატა `src/services/supabaseAuthService.ts`, სადაც მზად არის:

- `requestPhoneOtp(phone, role)` - SMS კოდის მოთხოვნა
- `verifyPhoneOtp(phone, token)` - SMS კოდის დადასტურება და session შენახვა
- `signInOrSignUpWithEmail(email, password, role)` - email/password login/signup
- `refreshSupabaseSession()` - access token-ის განახლება
- `signOutSupabase()` - Supabase logout და local session cleanup

`LoginScreen` უკვე მომზადებულია ორ რეჟიმზე:

- demo რეჟიმში მუშაობს ძველი სატესტო კოდი `1234` და remembered phone
- API რეჟიმში იძახებს `signInOrSignUpWithEmail()` helper-ს და Supabase session-ს ინახავს

`App.tsx` API რეჟიმში refresh-ზე session-ს აღადგენს, current user profile-იდან role/status-ს
კითხულობს და logout-ისას Supabase session-ს ასუფთავებს.

## Method Mapping

### Client profile

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getClientProfile(phone)` | `users` | phone-ით ან current user session-ით |
| `saveClientProfile(phone, profile)` | `users` update | სახელი, გვარი, ფოტო, rating |

ფოტო უნდა აიტვირთოს storage-ში, ხოლო `users.photo_url`-ში შეინახოს მხოლოდ URL.

დაემატა `src/services/supabaseStorageService.ts` და `src/services/profileApiService.ts`.
API რეჟიმში კლიენტის და ხელოსნის პროფილის ფოტო უკვე `profile-photos` bucket-ში
აიტვირთება და `update_current_user_profile` RPC-ს იძახებს. demo რეჟიმში local data URL
preview რჩება. ხელოსნის ვერიფიკაციის დოკუმენტები `verification-documents` bucket-ში
იტვირთება და `add_worker_verification_document` RPC-ს იძახებს.

ხელოსნის პროფილის სრული save/load დაემატა `get_current_worker_profile` და
`save_current_worker_profile` RPC-ებით. API რეჟიმში პროფესიები, დამატებითი კომენტარი,
ფასის ტიპი/მინ-მაქსი, სამუშაო დღეები/საათები და დაკავებული პერიოდები უკვე backend-ზე
ინახება, ხოლო demo რეჟიმში ძველი localStorage ქცევა რჩება.

### Client bookings

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getClientBookings()` | `bookings` + worker join | მხოლოდ current client-ის ჯავშნები |
| `saveClientBookings(bookings)` | აღარ გვჭირდება პირდაპირ | ჩანაცვლდება create/update endpoint-ებით |
| `updateClientBooking(id, updater)` | `bookings` update | status/payment/cancel/review ცვლილებები |

`saveClientBookings` production-ში არ უნდა არსებობდეს, რადგან მთელი სია ერთიანად არ უნდა
ჩაიწეროს. უნდა იყოს კონკრეტული მოქმედებები:

- `createBooking(payload)`
- `cancelBooking(id, reason)`
- `confirmWorkerCompleted(id)`
- `markBookingReviewed(id)`

### Craftsman requests

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getCraftsmanRequests()` | `bookings` | current worker-ის incoming jobs |
| `saveCraftsmanRequests(requests)` | აღარ გვჭირდება პირდაპირ | ჩანაცვლდება status update-ებით |
| `getRealCraftsmanRequests()` | `bookings` | demo filtering მოიხსნება |
| `pruneDemoCraftsmanRequests()` | აღარ გვჭირდება | production-ში demo data არ იქნება |
| `prependCraftsmanRequest(request)` | `createBooking` | კლიენტი ქმნის ჯავშანს |
| `updateCraftsmanRequestStatus(id, status)` | `bookings.status` update | სტატუსის ოფიციალური workflow |

production-ში ხელოსანთან მოთხოვნა უნდა გამოჩნდეს `bookings`-დან, არა ცალკე request list-იდან.

### Booking lifecycle

უნდა იყოს ცალკე API actions:

| action | allowed from | next status |
| --- | --- | --- |
| `confirmBooking(id)` | worker | `confirmed` |
| `declineBooking(id)` | worker | `declined` |
| `markEnRoute(id)` | worker | `en_route` |
| `markStarted(id)` | worker | `started` |
| `markWorkerCompleted(id)` | worker | `worker_completed` |
| `confirmClientCompleted(id)` | client | `client_confirmed` |
| `closeBooking(id)` | system/admin | `closed` |
| `cancelBooking(id, reason)` | client/worker | `cancelled` |
| `openDispute(id, reason)` | client/worker | `disputed` |

ეს status update-ები backend-მა უნდა შეამოწმოს. მაგალითად კლიენტს არ უნდა შეეძლოს
`markWorkerCompleted`, ხოლო ხელოსანს არ უნდა შეეძლოს `confirmClientCompleted`.

მიმდინარე მდგომარეობით API რეჟიმში ჯავშნის შექმნა, client/worker list, worker status
flow, client cancellation, refund და client completion confirmation official RPC-ებზეა.
Frontend აღარ ცვლის API ჯავშანს მხოლოდ local state-ში: action-ის შემდეგ სია თავიდან
იტვირთება backend-იდან. `scheduled_at` ინახება `details.scheduledAt`-შიც, რომ
გაუქმების უფასო/დაგვიანებული პერიოდი სწორად დაითვალოს.

### Messages

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getBookingMessages()` | `messages` | booking/thread მიხედვით |
| `saveBookingMessages(messages)` | `sendMessage` | მთელი სიის შენახვა მოიხსნება |
| `getMessageReads(role)` | `messages.read_at` ან `message_reads` | წაკითხვის სტატუსი |
| `markThreadRead(role, threadId, lastMessageAt)` | `markThreadRead(bookingId)` | current user-ის read marker |

საჭირო API:

- `getThreads()`
- `getMessages(bookingId)`
- `sendMessage(bookingId, text)`
- `markThreadRead(bookingId)`

### Disputes

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getBookingDisputes()` | `disputes` | current user-ის დავები |
| `saveBookingDisputes(disputes)` | აღარ გვჭირდება პირდაპირ | |
| `prependBookingDispute(dispute)` | `createDispute(payload)` | status უნდა გახდეს `disputed` |

დავის გახსნისას backend-მა უნდა განაახლოს `bookings.status = disputed`.

### Reviews

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getReviewedBookingIds()` | `reviews` | booking-ზე უკვე არის თუ არა review |
| `saveReviewedBookingIds(ids)` | აღარ გვჭირდება | review create ამოწმებს duplicate-ს |

საჭირო API:

- `createReview(bookingId, revieweeId, criteria, comment)`
- `getUserRating(userId)`
- `hasReviewedBooking(bookingId, reviewerId)`

review-ის შექმნის შემდეგ backend-მა უნდა განაახლოს `users.rating_avg` და `users.rating_count`.

### Notifications

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getClientNotifications()` | `notifications` | current user |
| `saveClientNotifications(notifications)` | აღარ გვჭირდება პირდაპირ | |
| `prependClientNotification(notification)` | `createNotification` | ძირითადად backend/system ქმნის |

საჭირო API:

- `getNotifications()`
- `markNotificationRead(id)`
- `markAllNotificationsRead()`

### Admin launch settings

დაემატა `supabase/admin_launch_actions.sql` და `src/services/adminApiService.ts`.
ეს ფენა ამზადებს Admin-ის production contract-ს იმ მონაცემებისთვის, რაც გადახდამდე
აუცილებელია:

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getPlatformSettings()` | `platform_settings` key=`platform` | booking fee, commission, provider choices |
| `savePlatformSettings(settings)` | `save_admin_platform_settings` | platform და legal settings ერთად ინახება audit log-ით |
| `getLegalSettings()` | `platform_settings` key=`legal` | ჯავშნის/გაუქმების/privacy/support ტექსტები |
| `getAdminMembers()` | `admin_members` | role/permissions/active |
| `updateAdminMember(id)` | `update_admin_member_state` | active/inactive და audit |
| `getPrePaymentChecklist()` | `launch_checklist_items` group=`pre_payment` | readiness checklist |
| `getMobileQaScenarios()` | `launch_checklist_items` group=`mobile_qa` | QA სცენარები |
| `updatePrePaymentChecklistItem()` / `updateMobileQaScenario()` | `update_launch_checklist_item` | Mobile QA ყველა პუნქტის დასრულებისას `qa` ავტომატურად იხურება |
| `getAdminAuditLogs()` | `audit_logs` | ბოლო 80 ჩანაწერი launch state-ში ბრუნდება |
| კლიენტის/ხელოსნის account status | `update_admin_account_status` | active/limited/blocked status და audit log |
| Admin booking close/refund/dispute | `admin_update_booking_action` | booking status, payment status, notifications და audit |
| Admin dispute reviewing | `admin_mark_dispute_reviewing` | dispute status, notifications და audit |
| Admin dispute resolution | `admin_resolve_dispute_action` | refund/release/warning resolution, booking/payment update და audit |
| Admin verification queue/review | `get_admin_launch_state` / `admin_review_worker_verification` | ატვირთული დოკუმენტები, approve/reject, worker unlock და audit |
| Admin booking/dispute lists | `list_admin_bookings` / `list_admin_disputes` | ყველა ჯავშანი/დავა client/worker/payment/details ინფორმაციით |
| Admin users/stats | `list_admin_users` | კლიენტები და ხელოსნები status/rating/verification/booking stats-ით |
| Admin identity/permissions | `get_current_admin_context` / `current_admin_has_permission` | logged-in Admin member, UI restrictions და backend RPC permission checks |

Frontend-ში `adminApiService` უკვე ამზადებს:

- `loadAdminLaunchState()`
- `saveAdminLaunchSettings(platformSettings, legalSettings)`
- `updateAdminMemberState(id, active)`
- `updateLaunchChecklistItem(id, done)`
- `updateAdminAccountStatus(role, phone, status, adminNote)`
- `updateAdminBookingAction(bookingId, action, adminNote)`
- `markAdminDisputeReviewing(disputeId, adminNote)`
- `resolveAdminDisputeAction(disputeId, resolution, adminNote)`
- `reviewAdminWorkerVerification(workerId, status, adminNote)`
- `loadAdminBookings()`
- `loadAdminDisputes()`
- `loadAdminUsers()`
- `loadCurrentAdminContext()`

`AdminScreen` API რეჟიმში უკვე ამ helper-ებს იყენებს launch settings/checklist/QA/admin
members/audit, კლიენტის/ხელოსნის სტატუსის ცვლილებისთვის, Admin booking actions-ისთვის
და დავების განხილვა/დახურვისთვის. Verification tab API mode-ში `verificationQueue`-ს
კითხულობს და approve/reject-ს backend-ზე ასრულებს. Bookings, Finance და Disputes tabs
API mode-ში `list_admin_bookings` / `list_admin_disputes` RPC-ებიდან მოდის. Users tab
API mode-ში `list_admin_users` RPC-დან აჩვენებს კლიენტებს, ხელოსნებს და dashboard
stats-ს. Admin UI უკვე ზღუდავს tabs/action ღილაკებს active Admin member permissions-ით:
owner ხედავს ყველაფერს, verification მხოლოდ verification/audit-ს, support
disputes/bookings/users/audit-ს, finance კი finance/disputes/audit-ს. დარჩენილი Admin
migration იყო real admin identity mapping-ის Supabase session-ზე მიბმა; ეს უკვე მზადაა:
API mode-ში active Admin member `get_current_admin_context` RPC-დან მოდის, role selector
read-only ხდება, ხოლო backend RPC-ები `current_admin_has_permission` helper-ით ამოწმებს
კონკრეტულ უფლებებს.

### Craftsman profile

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getCraftsmanProfile()` | `users` + `workers` + `worker_professions` | სრული პროფილი |
| `saveCraftsmanProfile(profile)` | update user/worker/professions | ნაწილობრივი update |
| `getCraftsmanTrialStart()` | `workers.trial_started_at` | backend-ის დროით |

პროფესიის არჩევა უნდა ჩაიწეროს `worker_professions`-ში. ფასი უნდა დაიყოს:

- `price_type`
- `price_min`
- `price_max`

ტექსტური `price: "40-60 ლარი"` production-ში მხოლოდ UI formatting უნდა იყოს.

### Verification

ამჟამად `CraftsmanProfile.verification` ინახავს boolean-ებს. backend-ზე უნდა გადავიდეს
`verification_documents` table-ზე.

საჭირო API:

- `uploadVerificationDocument(type, file)`
- `getVerificationStatus()`

როცა ატვირთულია:

- პირადობის წინა მხარე
- პირადობის უკანა მხარე
- საბანკო ანგარიშის დოკუმენტი

მაშინ UI აჩვენებს `ვერიფიკაციის მოთხოვნა გაგზავნილია`. როცა admin დაამტკიცებს,
status გახდება `verified`.

Demo რეჟიმში შეიძლება სამივე ატვირთვის შემდეგ პირდაპირ გამოჩნდეს `ვერიფიცირებული`.

### Worker unavailable ranges

| current method | backend table/API | შენიშვნა |
| --- | --- | --- |
| `getCraftsmanUnavailableRanges()` | `worker_unavailable_ranges` | current worker |
| `saveCraftsmanUnavailableRanges(ranges)` | create/delete range actions | მთელი სიის overwrite არ ჯობს |

საჭირო API:

- `getUnavailableRanges(workerId)`
- `addUnavailableRange(start, end, reason)`
- `deleteUnavailableRange(id)`

## API surface MVP

პირველი backend ვერსიისთვის საკმარისი endpoint/function სია:

### Auth

- `getCurrentUser()`
- `loginWithPhone(phone, role)`
- `logout()`

Supabase Auth-ისას `loginWithPhone(phone, role)` role-ს უნდა აგზავნიდეს metadata-ში:

```ts
{
  phone,
  options: {
    data: {
      role,
    },
  },
}
```

`supabase/auth.sql` ამ metadata-ს წაიკითხავს და `public.users.role`-ში ჩაწერს.
თუ role არის `craftsman`, ავტომატურად შეიქმნება `public.workers` ჩანაწერიც.

### Profiles

- `getClientProfile()`
- `updateClientProfile(payload)`
- `getCraftsmanProfile()`
- `updateCraftsmanProfile(payload)`
- `uploadProfilePhoto(file)`

### Workers

- `searchWorkers(filters)`
- `getRecommendedWorkers()`
- `getWorkerById(id)`
- `getProfessions()`

### Bookings

- `createBooking(payload)`
- `getClientBookings()`
- `getWorkerBookings()`
- `confirmBooking(id)`
- `declineBooking(id)`
- `markEnRoute(id)`
- `markStarted(id)`
- `markWorkerCompleted(id)`
- `confirmClientCompleted(id)`
- `cancelBooking(id, reason)`

### Messages

- `getThreads()`
- `getMessages(bookingId)`
- `sendMessage(bookingId, text)`
- `markThreadRead(bookingId)`

### Reviews

- `createReview(payload)`
- `getReviewsForUser(userId)`
- `getReviewedBookingIds(revieweeRole)`

### Verification

- `uploadVerificationDocument(type, file)`
- `getVerificationStatus()`

### Payments and disputes

- `createBookingPayment(bookingId)`
- `captureBookingPayment(bookingId)`
- `refundBookingPayment(bookingId)`
- `getBookingPaymentSummary(bookingId)`
- `openDispute(payload)`
- `getDisputes()`

MVP API workflow manual hold მოდელზეა მიბმული: `create_booking_request` booking
fee/provider/currency-ს backend `platform_settings`-იდან იღებს, `payments` row-ს
`authorized` სტატუსით ქმნის, `capture_booking_payment` და `refund_booking_payment`
audit log-ს წერს, ხოლო `get_booking_payment_summary` provider transaction id-საც
აბრუნებს. Production provider-ისთვის დარჩება Bank of Georgia/TBC init endpoint და
callback signature verification.

### Notifications

- `getNotifications()`
- `markNotificationRead(id)`

დაემატა `src/services/notificationApiService.ts` და `supabase/notification_actions.sql`.
API რეჟიმში notification list და unread count უკვე `list_my_notifications` /
`get_unread_notification_count` RPC-ებიდან იტვირთება, ხოლო read state იცვლება
`mark_notification_read`, `mark_booking_notifications_read` და
`mark_all_notifications_read` RPC-ებით. კლიენტის ჯავშნებში და ხელოსნის მთავარ
გვერდზე notification feed API რეჟიმში backend-იდან ჩანს.

## Migration order

0. Supabase REST helper and `.env` validation.
1. Auth/session layer.
2. Profile photo upload and profile save.
3. Workers/professions read-only API via `worker_cards` view.
4. Profession-specific booking questions.
5. Booking list via `list_my_client_bookings` / `list_my_worker_bookings`, creation via
   `create_booking_request` RPC and status updates via
   `update_booking_status_action` RPC.
6. Messages via `list_my_message_threads`, `list_booking_messages`,
   `send_booking_message` and `mark_booking_messages_read` RPC, then realtime.
7. Notifications via `list_my_notifications`, `get_unread_notification_count`,
   and read-state RPCs.
8. Reviews via `create_booking_review`, `list_my_reviewed_booking_ids` RPC and
   rating aggregation trigger.
9. Verification document upload.
10. Payments/disputes via booking fee authorization, `capture_booking_payment`,
   `refund_booking_payment`, `get_booking_payment_summary`, and
   `open_booking_dispute`; then real provider integration.
11. Subscription/trial logic.

## Frontend code change strategy

საწყისად არ შევცვალოთ ყველა screen ერთდროულად. უკეთესია:

1. შეიქმნას `apiService.ts`, რომელიც იმავე სახელების ნაწილს გაიმეორებს.
2. დაემატოს `src/services/dataService.ts`, რომელიც გადაწყვეტს demo თუ API რეჟიმს.
3. ეკრანები გადავიდეს `dataService`-ზე.
4. როცა backend მზად იქნება, `dataService` ჩართავს API რეჟიმს.

ასე demo ვერსია შენარჩუნდება Netlify-ზე, ხოლო რეალური ვერსია ეტაპობრივად აშენდება.

## Current Frontend Preparation

უკვე დამატებულია:

- `.env.example`
- `src/services/dataService.ts`
- `src/services/apiService.ts`

ამ ეტაპზე core frontend flow-ები Supabase RPC/storage ფენებს უკავშირდება და სამუშაო
გარემო უკვე `REACT_APP_DATA_MODE=api` რეჟიმშია. `apiService` local fallback მხოლოდ იმ
demo-only helper-ებისთვის რჩება, რომლებიც UI convenience-ს ემსახურება და backend-ის
ჭეშმარიტ მონაცემად აღარ გამოიყენება.
