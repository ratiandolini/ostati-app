# Launch Readiness

## მიმდინარე ნაბიჯი

აპი უკვე მუშაობს dual-mode არქიტექტურით: demo რეჟიმში ინახავს მონაცემებს
`localStorage`-ში, ხოლო API რეჟიმში ძირითადი ნაკადები Supabase RPC/storage ფენებზეა
მიბმული. რეალურ გაშვებამდე მთავარი დარჩენილი ზონა არის production readiness-ის
დახურვა, მობილური QA, საბოლოო legal ტექსტები და შემდეგ რეალური payment provider-ის
მიერთება.

Admin პანელში უკვე არის launch dashboard, Supabase preflight, production blockers,
readiness report და role-based Admin წვდომები. ეს ნიშნავს, რომ გადახდებზე გადასვლამდე
აპს შეუძლია თავად აჩვენოს რა აკლია production-ready მდგომარეობამდე.

## რატომ არის ეს პირველი

რეალურ გაშვებამდე კლიენტის, ხელოსნის, ჯავშნის, მესიჯის, შეფასების და გადახდის
მონაცემები ერთ საერთო სერვერზე უნდა ინახებოდეს. თუ ყველა ეკრანი პირდაპირ
`localStorage`-ს კითხულობს, backend-ზე გადასვლა ბევრ ადგილას ერთდროულად ცვლილებას
მოითხოვს. ცენტრალური storage service ამ რისკს ამცირებს.

## უკვე გაკეთდა

- დაემატა `src/services/appStorage.ts`.
- `App.tsx` გადავიდა ამ service-ზე კლიენტის პროფილის, ჯავშნების, ხელოსნის მოთხოვნების
  და unread message count-ის ნაწილში.
- ჯავშნის შექმნისას ხელოსნის მოთხოვნა იწერება ერთი helper-ით.
- კლიენტის მიერ დასრულების დადასტურებისას ხელოსნის request status ერთიანი helper-ით
  ახლდება.
- `MessagesScreen.tsx` აღარ იყენებს `localStorage`-ს პირდაპირ; მესიჯების კითხვა/ჩაწერა,
  thread read receipts და ხელოსნის request-ების კითხვა გადავიდა data layer-ზე.
- `BookingsScreen.tsx` აღარ იყენებს `localStorage`-ს პირდაპირ; dispute-ები, reviewed booking IDs,
  client notifications და booking payment status update გადავიდა data layer-ზე.
- `CraftsmanHomeScreen.tsx` აღარ იყენებს `localStorage`-ს პირდაპირ; ხელოსნის პროფილი,
  trial start, დაკავებული პერიოდები, request sync, booking status update და client
  notifications გადავიდა data layer-ზე.
- დარჩენილი ეკრანები (`LoginScreen.tsx`, `ProfileScreen.tsx`, `ProfileUserScreen.tsx`,
  `SearchScreen.tsx`) ასევე გადავიდა data layer-ზე. ახლა `localStorage` მხოლოდ
  `src/services/appStorage.ts`-შია.
- დაემატა `DATABASE_SCHEMA.md`, სადაც გაწერილია users, workers, professions, bookings,
  booking details, messages, reviews, verification documents, payments, disputes,
  notifications და subscriptions-ის სტრუქტურა.
- დაემატა `API_SERVICE_PLAN.md`, სადაც გაწერილია `appStorage`-ის თითოეული ნაწილის
  backend/API-ზე გადატანის გზა და რეკომენდებული migration order.
- დაემატა `src/services/dataService.ts`; ეკრანები პირდაპირ `appStorage`-ს აღარ ებმება.
  ამით demo/local და real/API რეჟიმების გაყოფა მარტივი გახდება.
- დალაგდა TypeScript შემოწმება: `tsconfig.json` აღარ აყოლებს შეუთავსებელ Node type-ებს,
  დაემატა `src/env.d.ts`, და `npx.cmd tsc --noEmit` წარმატებით გადის.
- დაემატა local production build wrapper: `scripts/build-local.js` და npm script
  `build:local`. ეს ჯერ `tsc --noEmit`-ს ატარებს, შემდეგ კი CRA build-ს უშვებს იმ
  TypeScript checker child process-ის გარეშე, რომელსაც ამ Windows/sandbox გარემო
  `spawn EPERM`-ით ბლოკავდა.
- დაემატა Netlify upload helper: `scripts/prepare-netlify-upload.js`, npm script
  `deploy:prep` და `NETLIFY_DEPLOY.md`. ეს build-ის შემდეგ ავტომატურად ამზადებს
  `NETLIFY_UPLOAD_THIS` ფოლდერს, რომ ასატვირთად root-ში იყოს `index.html`,
  `_redirects`, `asset-manifest.json` და `static`.
- დაემატა `.env.example` Supabase/API გარემოს ცვლადებისთვის.
- დაემატა `src/services/apiService.ts` skeleton. ის იგივე contract-ს ატარებს, რასაც
  `appStorage`, მაგრამ თუ `REACT_APP_DATA_MODE=api` ჩაირთვება backend-ის მიერთებამდე,
  მკაფიო error-ს აჩვენებს და ჩუმად fake მონაცემებს არ დააბრუნებს.
- დაემატა `src/services/supabaseRest.ts`, SDK-ის გარეშე მომუშავე Supabase REST helper.
  ის ამოწმებს `.env` კონფიგურაციას და გვაძლევს typed `select`, `insert`, `update`,
  `remove`, `rpc` მეთოდებს შემდეგი API migration-ისთვის. REST მოთხოვნები session-ის
  არსებობისას user access token-ით იგზავნება.
- დაემატა `src/services/supabaseConfig.ts` და `src/services/supabaseAuthService.ts`.
  Auth helper ამზადებს SMS OTP request/verify, session refresh და signout flow-ს,
  რომ შემდეგ `LoginScreen` demo login-იდან რეალურ Supabase Auth-ზე გადავიდეს.
- `LoginScreen` უკვე მუშაობს dual-mode პრინციპით: demo რეჟიმში რჩება სატესტო `1234`,
  ხოლო API რეჟიმში Supabase email/password helper-ს იყენებს. `App.tsx` refresh-ზე
  session-ს აღადგენს, current user profile-იდან role/status-ს იღებს და logout-ისას
  Supabase session-ს ასუფთავებს.
- დაემატა `src/services/supabaseStorageService.ts` და `src/services/profileApiService.ts`.
  კლიენტის და ხელოსნის პროფილის ფოტო API რეჟიმში უკვე Supabase Storage-ის
  `profile-photos` bucket-ში აიტვირთება, ხოლო demo რეჟიმში ძველი local preview რჩება.
  ხელოსნის ვერიფიკაციის დოკუმენტები API რეჟიმში `verification-documents` bucket-ში
  იტვირთება და `verification_documents` table-ში RPC-ით რეგისტრირდება.
- ხელოსნის სამუშაო პროფილის მეორე ეტაპი API-ზე გადავიდა: `CraftsmanHomeScreen` API
  რეჟიმში ტვირთავს და ინახავს პროფესიებს, დამატებით კომენტარს, ფასს, სამუშაო
  დღეებს/საათებს და დაკავებულ პერიოდებს `get_current_worker_profile` /
  `save_current_worker_profile` RPC-ებით.
- ჩატის მესამე ეტაპი API-ზე გადავიდა: `MessagesScreen` API რეჟიმში იღებს thread list-ს,
  last message-ს, unread count-ს და კონკრეტული ჯავშნის მესიჯებს Supabase RPC-ებიდან.
  ქვედა მენიუს unread badge-იც იმავე backend count-ს იყენებს.
- ნოტიფიკაციების მეოთხე ეტაპი API-ზე გადავიდა: notification list და unread count
  backend RPC-ებიდან მოდის, read-state action-ებით ახლდება, კლიენტს ჯავშნებში
  notification feed აქვს, ხელოსანს კი მთავარ გვერდზე ახალი შეტყობინებები უჩანს.
- შეფასებების მეხუთე ეტაპი API-ზე გადავიდა: კლიენტის და ხელოსნის შეფასებები
  `create_booking_review` RPC-ით იქმნება, უკვე შეფასებული ჯავშნები
  `list_my_reviewed_booking_ids` RPC-ით იტვირთება, duplicate შეფასება backend-ზე
  იბლოკება და `worker_completed` სტატუსი კლიენტთან review notification-ს აგზავნის.
- გადახდის და დავის მეექვსე ეტაპი API-ზე გადავიდა: payment capture/refund-ს დაემატა
  payment summary RPC, კლიენტის ჯავშნებში ჩანს booking fee და აპის წილი, ხოლო
  პრობლემის გახსნა `open_booking_dispute` RPC-ით backend-ზე მუშაობს.
- დაემატა Supabase საწყისი ფაილები:
  `supabase/schema.sql`, `supabase/auth.sql`, `supabase/seed.sql`,
  `supabase/profession_questions.sql`,
  `supabase/booking_workflow.sql`, `supabase/review_workflow.sql`,
  `supabase/payment_workflow.sql`, `supabase/dispute_workflow.sql`,
  `supabase/subscription_workflow.sql`,
  `supabase/policies.sql`,
  `supabase/booking_actions.sql`,
  `supabase/profile_actions.sql`,
  `supabase/review_actions.sql`,
  `supabase/message_actions.sql`,
  `supabase/notification_actions.sql`,
  `supabase/payment_actions.sql`,
  `supabase/dispute_actions.sql`,
  `supabase/booking_list.sql`,
  `supabase/public_catalog.sql`,
  `supabase/storage.sql`, `supabase/README.md`.
  schema ქმნის ძირითად table-ებს, enum-ებს, index-ებს, updated_at trigger-ებს და RLS-ს.
  auth ამატებს Supabase Auth -> app user mapping trigger-ს. seed ამატებს სარემონტო
  პროფესიის საწყის სიას. profession questions ამატებს პროფესიაზე მორგებულ ჯავშნის
  კითხვებს. booking workflow იცავს ჯავშნის status მიმდევრობას და
  ქმნის notification-ებს. review workflow ამოწმებს review მონაწილეებს და აახლებს
  rating-ს. payment workflow ითვლის 10% საწყის საკომისიოს და ხელოსნის წილს.
  dispute workflow დავებს booking status-ს უკავშირებს და cancellation audit-ს ქმნის.
  subscription workflow ხელოსნებს 30 დღიან უფასო პერიოდს და საწყის 50 GEL თვიურ
  გეგმას უმზადებს.
  policies ამზადებს Auth-ზე მიბმულ წვდომის წესებს და helper ფუნქციებს.
  booking actions ქმნის official `create_booking_request` და `update_booking_status_action`
  RPC-ებს. პირველი booking-ს, details-ს და ხელოსნის notification-ს ერთად წერს, მეორე
  კი კლიენტის/ხელოსნის სტატუსების ცვლილებას backend-იდან ამოწმებს.
  profile actions ქმნის profile update-ს, worker profile save/load-ს და verification
  document RPC-ებს.
  review actions ქმნის official `create_booking_review` და reviewed booking list RPC-ებს,
  ხოლო rating aggregation-ს review workflow trigger აახლებს.
  message actions ქმნის thread list/message list, `send_booking_message` და
  `mark_booking_messages_read` RPC-ებს.
  notification actions ქმნის notification list/count/read-state RPC-ებს.
  payment actions ქმნის booking fee capture/refund/summary RPC-ებს; real provider
  integration შემდეგ ამავე actions-ს მიებმება.
  dispute actions ქმნის official dispute open RPC-ს.
  booking list ქმნის client/worker booking list RPC-ებს, რომ UI localStorage-ზე აღარ
  იყოს დამოკიდებული.
  public catalog ქმნის უსაფრთხო worker_cards view-ს, რომ კლიენტმა ტელეფონის გარეშე
  ნახოს ხელოსნის ბარათი.
  storage კი bucket-ებს და საწყის file policies-ს.
- Admin პანელში დაემატა "გადახდამდე გასაკეთებელი" checklist. აქ ჩანს Auth/Profile,
  Booking Flow, Chat, Verification, Reviews, Rules, Supabase API და Mobile QA
  მდგომარეობა, რომ გადახდებზე გადასვლამდე ყველა ძირითადი ნაწილი დახურული იყოს.
- Admin overview-ში დაემატა "სისტემური შემოწმება". ეს ავტომატურად აჩვენებს
  მონაცემების რეჟიმს, Supabase config-ს, auth provider-ს, payment provider-ს და
  production mode-ს, რომ demo და რეალური რეჟიმები ერთმანეთში არ აირიოს.
- Admin overview-ში დაემატა "Mobile QA სცენარები". აქ ცალ-ცალკე ინიშნება
  კლიენტის ჯავშანი, გაუქმება, ხელოსნის status flow, ჩატი/unread badge, ორმხრივი
  შეფასება, ხელოსნის ვერიფიკაციის lock, Admin dispute flow და მობილური layout.
  ყველა სცენარის მონიშვნისას pre-payment checklist-ის QA პუნქტი ავტომატურად იხურება.
- დაემატა სამართავი legal/support ტექსტები: ჯავშნის წესი, გაუქმების წესი,
  კონტაქტი/privacy და დავების წესი. ეს ტექსტები ინახება data layer-ში და კლიენტის
  დაჯავშნის/გაუქმების ეკრანებზე ერთიანი წყაროდან ჩანს.
- შესვლის ეკრანზე "მომსახურების პირობები" უკვე იხსნება modal-ად და აჩვენებს
  Admin-იდან სამართავ ჯავშნის, გაუქმების, privacy/contact და support/dispute ტექსტებს.
- ხელოსნის დაჯავშნის modal-ში დაემატა "ყველა წესის ნახვა", რომ კლიენტმა დაჯავშნამდე
  ნახოს არა მხოლოდ cancellation წესი, არამედ ჯავშნის, privacy/contact და დავების
  პირობებიც.
- Admin settings-ში Production mode-ს დაემატა guard. თუ Supabase/API ან auth provider
  demo რეჟიმშია, Production mode აღარ ჩაირთვება და Admin-ს blocker-ების სია გამოუჩნდება.
  გადახდებზე `manual_mvp_hold` ითვლება საპილოტე რეჟიმად; რეალური თანხის ჩამოჭრისთვის
  Bank of Georgia/TBC provider ცალკე ეტაპად რჩება.
- Admin-ის ზედა export ღილაკი გადაიქცა launch readiness report-ად. JSON-ში ახლა შედის
  production readiness, system checks, pre-payment checklist, Mobile QA სცენარები,
  legal settings, finance summary, admin members, audit logs, disputes და ჯავშნები.
  ფაილი ინახება სახელით `launch-readiness-report-YYYY-MM-DD.json`.
- Admin overview-ში დაემატა API migration map. აქ ცალ-ცალკე ჩანს Auth, Catalog,
  Profiles, Bookings, Messages, Notifications, Reviews, Disputes, Payments, Admin
  და Launch/QA ფენები სტატუსებით: `მიერთებულია`, `ნაწილობრივია`, `demo fallback`.
  თითოეულ ფენას აქვს next step, ხოლო launch readiness report-ში იგივე მონაცემები
  JSON-ად გადის.
- დაემატა `supabase/admin_launch_actions.sql`, რომელიც ამზადებს Admin backend ფენას:
  `platform_settings`, `admin_members`, `launch_checklist_items`, RLS policies და
  RPC actions `get_admin_launch_state`, `save_admin_platform_settings`,
  `update_admin_member_state`, `update_launch_checklist_item`.
- დაემატა `src/services/adminApiService.ts`, frontend helper API რეჟიმისთვის. ეს
  helper კითხულობს/ინახავს Admin launch state-ს Supabase RPC-ებით; Demo mode-ში
  local fallback რჩება მხოლოდ სწრაფი UI ტესტისთვის.
- `AdminScreen` API რეჟიმში რეალურად მიება `adminApiService` helper-ებს. API mode-ში
  platform/legal settings, admin members, pre-payment checklist, Mobile QA სცენარები
  და audit logs Supabase RPC-ებიდან იტვირთება; save/toggle მოქმედებები შესაბამის RPC-ს
  იძახებს. Demo mode-ში ძველი localStorage ქცევა რჩება.
- Admin account status actions API-ზე გადავიდა. `update_admin_account_status` RPC
  კლიენტისა და ხელოსნის `active/limited/blocked` სტატუსს backend-ზე ინახავს,
  ხელოსნის `is_active` მდგომარეობას ვერიფიკაციასთან ერთად აწყობს და audit log-ს
  წერს.
- Admin booking/dispute actions API-ზე გადავიდა. `admin_update_booking_action`,
  `admin_mark_dispute_reviewing` და `admin_resolve_dispute_action` backend-ზე ცვლის
  booking/payment/dispute მდგომარეობას, ორივე მხარეს notification-ს უგზავნის და
  audit log-ს წერს.
- Admin verification review API-ზე გადავიდა. `get_admin_launch_state` აბრუნებს
  verification queue-ს დოკუმენტებით, ხოლო `admin_review_worker_verification`
  approve/reject action-ით აახლებს verification documents-ს, worker/user status-ს,
  notification-ს და audit log-ს.
- Admin booking/dispute list read API-ზე გადავიდა. `list_admin_bookings` და
  `list_admin_disputes` RPC-ები Admin-ს აძლევს ყველა ჯავშანს/დავას client, worker,
  payment, details და dispute ინფორმაციით; AdminScreen-ის Bookings, Finance და
  Disputes tabs API mode-ში ამ სიებს იყენებს.
- Admin users/stats API-ზე გადავიდა. `list_admin_users` აბრუნებს კლიენტებს და
  ხელოსნებს status, rating, verification და booking stats-ით; AdminScreen-ის Users
  tab API mode-ში ამ სიას იყენებს.
- Admin role/permission-based UI restrictions დაემატა. Active Admin member-ის permissions
  მიხედვით tabs, summary cards, report export და action ღილაკები იზღუდება: owner-ს
  სრული წვდომა აქვს, verification/support/finance კი მხოლოდ შესაბამის სექციებს
  ხედავენ.
- Real Admin identity mapping Supabase session-ზე გადავიდა. API mode-ში
  `get_current_admin_context` აბრუნებს current Admin member-ს, role selector read-only
  ხდება, ხოლო Admin RPC-ები `current_admin_has_permission` helper-ით backend-ზეც
  ამოწმებენ კონკრეტულ უფლებებს.
- Booking flow API-ზე დაიხურა. კლიენტის ჯავშნის შექმნა, სიის ჩატვირთვა, გაუქმება,
  refund, დასრულების დადასტურება და ხელოსნის status flow official Supabase RPC-ებით
  სრულდება. API რეჟიმში UI ჯერ backend action-ს ელოდება და შემდეგ reload-ით იღებს
  ჭეშმარიტ მდგომარეობას. `list_my_client_bookings` აბრუნებს `scheduled_at`-ს
  `details.scheduledAt`-შიც, რომ უფასო/დაგვიანებული გაუქმების დრო სწორად დაითვალოს.
- Payment workflow API-ზე დაიხურა MVP დონეზე. ჯავშნის საფასური, provider და currency
  backend `platform_settings`-იდან მოდის, payment row authorized hold-ად იქმნება,
  capture/refund audit log-ს წერს, ხოლო payment summary provider/transaction მონაცემებს
  აბრუნებს. Production-მდე დარჩება კონკრეტული Bank of Georgia/TBC init და callback
  signature verification.
- Supabase preflight რეალურ API შემოწმებად დალაგდა. უსესიოდ აღარ ეშვება Admin RPC-ების
  cascade, არა-Admin session-ზე Admin-only შემოწმებები warning-ად ჩანს, შეცდომებს კი
  კონკრეტული next action და საჭირო SQL ფაილი აქვს.
- წარმატებული Supabase preflight ავტომატურად ხურავს pre-payment checklist-ის
  `supabase` პუნქტს. preflight-ს აქვს ბოლო შემოწმების დრო, 24-საათიანი freshness
  წესი და browser cache, რომელიც კონკრეტულ Supabase project host-ზეა მიბმული.
- Admin Settings-ში დაემატა Production blocker-ების ცალკე პანელი. პანელი იყენებს
  მიმდინარე draft settings-ს, ამიტომ dropdown-ების შეცვლისთანავე ჩანს რა ბლოკავს
  production mode-ს.
- Launch readiness report-ში დაემატა Supabase preflight summary/checks, preflight scope,
  freshness status, production guard count/items და draft production readiness.
- Launch readiness report-ს დაემატა `draft/launch_ready` სტატუსი. თუ smoke flow ან
  production blocker-ები დარჩენილია, ჩამოტვირთვამდე Admin-ს უჩვენებს გაფრთხილებას,
  ხოლო JSON-ში ინახება `launchStatus` და `draftReasons`.
- Admin overview-ში დაემატა "Launch-ის შემდეგი მოქმედება". ეს ბლოკი Admin-ს
  აჩვენებს ყველაზე ახლო ნაბიჯს: smoke flow-ის გაგრძელებას, production blocker-ის
  გასწორებას ან საბოლოო report-ის ჩამოტვირთვას.
- Mobile QA სცენარებს დაემატა მოკლე test guide: თითოეულ პუნქტზე ჩანს გასავლელი
  ნაბიჯები და მოსალოდნელი შედეგი, რომ რეალურ ტელეფონზე შემოწმება ერთიანი წესით
  მოხდეს.
- Mobile QA card-ებზე შემთხვევითი მონიშვნის რისკი მოიხსნა: card-ის წაკითხვა ცალკეა,
  ხოლო დასრულება/მოხსნა ხდება მხოლოდ კონკრეტული ღილაკით.
- Mobile QA სცენარებს დაემატა Admin შენიშვნა. რეალურ ტელეფონზე აღმოჩენილი პრობლემა
  იწერება card-ზევე, API რეჟიმში `launch_checklist_items.note`-ში ინახება და readiness
  report-ის `mobileQaScenarios` ნაწილში გადის.
- Mobile QA სექციაში ჩანს შენიშვნების რაოდენობა და compact summary, ხოლო readiness
  report summary-ში დაემატა `mobileQaNotesCount` და `mobileQaNotes`.
- ღია Mobile QA შენიშვნები production blocker-ად ითვლება. სანამ შენიშვნები არ
  გასუფთავდება ან შესაბამისი პრობლემა არ დაიხურება, report დარჩება `Draft` სტატუსში.
- Mobile QA card-ზე შენიშვნის სწრაფად გასუფთავებისთვის დაემატა
  `შენიშვნის გასუფთავება` ღილაკი.
- `update_launch_checklist_item` RPC-ს დაემატა backwards-compatible fallback: თუ
  Supabase-ში `p_note` პარამეტრიანი SQL ჯერ არ არის გაშვებული, QA done/unchecked
  მაინც იმუშავებს; note-ის backend-ში შესანახად საჭიროა
  `supabase/admin_launch_actions.sql`-ის ხელახლა გაშვება.
- Supabase preflight-ს დაემატა `Mobile QA note schema` check. თუ backend response-ში
  `note` ველი ჯერ არ ჩანს, Admin Settings-ში warning გამოჩნდება და მიგანიშნებს
  `supabase/admin_launch_actions.sql`-ის ხელახლა გაშვებაზე.
- `admin_launch_actions.sql` ახლა ძველ `update_launch_checklist_item(text, boolean)`
  function signature-ს შლის და ახალ `p_note`-იან ვერსიას ქმნის, რომ Supabase-ის
  `PGRST203 function overloading` შეცდომა აღარ გამოჩნდეს.
- Private Storage preflight პუნქტი green/manual QA სტატუსად გადავიდა. browser-იდან
  bucket policies სრულად ვერ მოწმდება, ამიტომ საკმარისია ხელით დადასტურდეს, რომ
  profile/chat/verification ფაილები იტვირთება და Admin signed URL-ით იხსნება.

## შემდეგი ტექნიკური ნაბიჯები

1. Admin overview-ში "Launch-ის შემდეგი მოქმედება" ბლოკით გაიაროს დარჩენილი ნაბიჯები.
2. Admin-ში production blockers პანელი ნულამდე ჩამოვიდეს.
3. Mobile QA სცენარები რეალურ ტელეფონზე სრულად გაიაროს.
4. Legal/support ტექსტები საბოლოოდ გადაიკითხოს და დამტკიცდეს.
5. Client/worker end-to-end smoke test გაიაროს API რეჟიმში:
   კლიენტის რეგისტრაცია, ხელოსნის რეგისტრაცია, ვერიფიკაცია, ჯავშანი, ჩატი,
   status flow, დასრულება, შეფასება, დავა.
6. Admin report ჩამოიტვირთოს და შეინახოს როგორც launch snapshot მხოლოდ მაშინ, როცა
   report badge `Ready`-ს აჩვენებს.
7. შემდეგ დაიწყოს რეალური payment provider-ის ეტაპი: Bank of Georgia/TBC init,
   callback signature verification, capture/refund reconciliation და receipt/history UI.

## Build Commands

- TypeScript შემოწმება: `npm.cmd run typecheck`
- ლოკალური production build ამ კომპიუტერზე: `npm.cmd run build:local`
- Netlify Drop-ისთვის upload folder-ის მომზადება: `npm.cmd run deploy:prep`
- სტანდარტული hosting build: `npm run build`, თუ hosting გარემოში child process შეზღუდვა არ არის
