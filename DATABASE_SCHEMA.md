# Database Schema

ეს დოკუმენტი აღწერს რეალური backend-ის საწყის სტრუქტურას. მიზანია, რომ აპი
localStorage-დან გადავიდეს საერთო სერვერულ მონაცემებზე ისე, რომ კლიენტის,
ხელოსნის, ჯავშნის, ჩატის, გადახდის და ვერიფიკაციის ლოგიკა არ აირიოს.

## ძირითადი პრინციპი

- `users` ინახავს ყველას საერთო ანგარიშს: კლიენტს და ხელოსანს.
- `workers` არის ხელოსნის დამატებითი პროფილი.
- `bookings` არის მთავარი საქმიანი ჩანაწერი, რომლის გარშემოც ებმება ჩატი,
  შეფასება, გადახდა, დავა და ნოტიფიკაცია.
- ტელეფონი კლიენტის მხარეს არ ჩანს, სანამ სისტემა ამას ცალკე წესით არ დაუშვებს.
- შეფასება ხდება დასრულებული ან გაუქმებული სამუშაოს შემდეგ.
- გადახდა და საკომისიო უნდა იყოს მიბმული კონკრეტულ ჯავშანზე.

## Tables

### users

ყველა მომხმარებელი, როლის მიუხედავად.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| role | enum | `client`, `craftsman`, `admin` |
| phone | text | ავტორიზაციის ნომერი |
| first_name | text | სახელი |
| last_name | text | გვარი |
| photo_url | text | პროფილის ფოტო |
| rating_avg | numeric | საშუალო შეფასება |
| rating_count | integer | შეფასებების რაოდენობა |
| status | enum | `active`, `blocked`, `pending` |
| created_at | timestamp | შექმნის დრო |
| updated_at | timestamp | ბოლო ცვლილება |
| last_login_at | timestamp | ბოლო შესვლა |

### workers

ხელოსნის სამუშაო პროფილი.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| user_id | uuid | ბმა `users.id`-ზე |
| display_name | text | საჯარო სახელი |
| city | text | ქალაქი |
| address_area | text | უბანი/არეალი |
| about | text | მოკლე აღწერა |
| price_type | enum | `fixed`, `from`, `range` |
| price_min | numeric | მინიმალური ფასი |
| price_max | numeric | მაქსიმალური ფასი, თუ range არის |
| main_profession_id | uuid | ძირითადი პროფესია |
| verification_status | enum | `not_started`, `pending`, `verified`, `rejected` |
| is_active | boolean | ჩანს თუ არა ძიებაში |
| trial_started_at | timestamp | უფასო პერიოდის დასაწყისი |
| subscription_status | enum | `trial`, `active`, `past_due`, `paused` |
| created_at | timestamp | შექმნის დრო |
| updated_at | timestamp | ბოლო ცვლილება |

### professions

სარემონტო სფეროების კატალოგი.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| name | text | პროფესიის სახელი |
| category | text | ფართო კატეგორია |
| is_active | boolean | ჩანს თუ არა არჩევაში |
| sort_order | integer | დალაგება |

### worker_professions

ხელოსნის რამდენიმე პროფესიის ბმა.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| worker_id | uuid | ბმა `workers.id`-ზე |
| profession_id | uuid | ბმა `professions.id`-ზე |

### worker_schedule

ხელოსნის ჩვეულებრივი სამუშაო საათები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| worker_id | uuid | ხელოსანი |
| weekday | integer | 1 ორშაბათი, 7 კვირა |
| start_time | time | სამუშაოს დასაწყისი |
| end_time | time | სამუშაოს დასასრული |

### worker_unavailable_ranges

დაკავებული ან მიუწვდომელი პერიოდები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| worker_id | uuid | ხელოსანი |
| starts_at | timestamp | როდიდან არ სცალია |
| ends_at | timestamp | როდემდე არ სცალია |
| reason | text | სურვილისამებრ მიზეზი |

### bookings

მთავარი ჯავშნის/საქმის ჩანაწერი.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| client_id | uuid | კლიენტი |
| worker_id | uuid | ხელოსანი |
| profession_id | uuid | არჩეული პროფესია |
| scheduled_at | timestamp | ვიზიტის დრო |
| status | enum | ჯავშნის სტატუსი |
| city | text | სამუშაო ქალაქი |
| address_text | text | მისამართი |
| client_comment | text | კლიენტის კომენტარი |
| booking_fee_amount | numeric | ჩამოჭრილი/დაბლოკილი თანხა |
| payment_status | enum | `not_required`, `authorized`, `captured`, `refunded`, `failed` |
| cancellation_reason | text | გაუქმების მიზეზი |
| created_at | timestamp | შექმნის დრო |
| updated_at | timestamp | ბოლო ცვლილება |

ჯავშნის სტატუსები:

| სტატუსი | მნიშვნელობა |
| --- | --- |
| pending | კლიენტმა გაგზავნა, ხელოსანი ჯერ არ გამოხმაურებულა |
| confirmed | ხელოსანმა დაადასტურა |
| en_route | ხელოსანი გზაშია |
| started | სამუშაო დაიწყო |
| worker_completed | ხელოსანმა დაასრულა |
| client_confirmed | კლიენტმა დაადასტურა დასრულება |
| closed | საქმე საბოლოოდ დაიხურა |
| declined | ხელოსანმა უარი თქვა |
| cancelled | კლიენტმა ან ხელოსანმა გააუქმა |
| disputed | გახსნილია დავა |

### booking_details

პროფესიაზე დამოკიდებული კითხვების პასუხები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| booking_id | uuid | ბმა `bookings.id`-ზე |
| area | numeric | კვადრატულობა |
| height | numeric | სიმაღლე |
| length | numeric | სიგრძე |
| rooms | integer | ოთახების რაოდენობა |
| wall_condition | text | კედლის მდგომარეობა |
| target_surface | text | ჭერი/კედელი/სხვა |
| material_owner | enum | `client`, `worker`, `unknown` |
| plumbing_type | text | გაჟონვა, მონტაჟი და სხვა |
| floor | integer | სართული |
| electric_points | integer | ელექტრო წერტილების რაოდენობა |
| electric_panel | text | ფარის ტიპი/მდგომარეობა |
| is_emergency | boolean | ავარიულია თუ არა |
| extra_measurements | json | დამატებითი მონაცემები |
| uploaded_photo_url | text | სამუშაო ადგილის ფოტო |

### profession_booking_questions

პროფესიის მიხედვით ჯავშნისას დასასმელი კითხვები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| profession_id | uuid | პროფესია |
| key | text | რომელ ველში ჩაიწერება პასუხი |
| label | text | კლიენტისთვის ნაჩვენები კითხვა |
| placeholder | text | დამხმარე ტექსტი |
| input_type | enum | `text`, `number`, `boolean`, `select`, `photo` |
| options_json | json | select ვარიანტები |
| is_required | boolean | სავალდებულოა თუ არა |
| sort_order | integer | დალაგება |

### messages

კლიენტისა და ხელოსნის მიმოწერა კონკრეტულ ჯავშანზე.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| booking_id | uuid | ჯავშანი |
| sender_id | uuid | გამგზავნი |
| text | text | ტექსტი |
| created_at | timestamp | გაგზავნის დრო |
| read_at | timestamp | წაკითხვის დრო |

### reviews

შეფასებები სამუშაოს შემდეგ.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| booking_id | uuid | ჯავშანი |
| reviewer_id | uuid | ვინ აფასებს |
| reviewee_id | uuid | ვის აფასებს |
| reviewee_role | enum | `client`, `craftsman` |
| overall_rating | integer | 1-დან 5-მდე |
| criteria_json | json | კრიტერიუმების ქულები |
| comment | text | კომენტარი |
| created_at | timestamp | შეფასების დრო |

ხელოსნის შეფასების საწყისი კრიტერიუმები:

- შესრულებული სამუშაოს ხარისხი
- დროულად მისვლა ობიექტზე
- სისუფთავე
- დათქმულ ვადაში ჩაბარება
- კომუნიკაცია

კლიენტის შეფასების საწყისი კრიტერიუმები:

- კომუნიკაცია
- დროის მენეჯმენტი
- შეთანხმების დაცვა

### verification_documents

ხელოსნის ვერიფიკაცია.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| worker_id | uuid | ხელოსანი |
| type | enum | `id_front`, `id_back`, `bank_account` |
| file_url | text | ატვირთული ფაილი |
| status | enum | `pending`, `approved`, `rejected` |
| reviewed_by | uuid | ადმინი |
| reviewed_at | timestamp | შემოწმების დრო |
| created_at | timestamp | ატვირთვის დრო |

### payments

გადახდები და აპის საკომისიო.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| booking_id | uuid | ჯავშანი |
| payer_id | uuid | გადამხდელი |
| worker_id | uuid | ხელოსანი |
| amount | numeric | მთლიანი თანხა |
| platform_fee_amount | numeric | აპის საკომისიო |
| worker_amount | numeric | ხელოსნის წილი |
| currency | text | GEL |
| provider | text | გადახდის პროვაიდერი |
| provider_payment_id | text | პროვაიდერის ID |
| status | enum | `authorized`, `captured`, `refunded`, `failed` |
| captured_at | timestamp | ჩამოჭრის დრო |
| refunded_at | timestamp | დაბრუნების დრო |
| created_at | timestamp | შექმნის დრო |

### disputes

დავები და პრობლემური შემთხვევები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| booking_id | uuid | ჯავშანი |
| opened_by | uuid | ვინ გახსნა |
| reason | text | მიზეზი |
| details | text | დეტალები |
| status | enum | `open`, `reviewing`, `resolved`, `rejected` |
| admin_note | text | შიდა კომენტარი |
| resolved_at | timestamp | გადაწყვეტის დრო |
| created_at | timestamp | გახსნის დრო |

### notifications

აპლიკაციის შიდა შეტყობინებები.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| user_id | uuid | მიმღები |
| booking_id | uuid | სურვილისამებრ ჯავშანი |
| type | text | შეტყობინების ტიპი |
| title | text | სათაური |
| body | text | ტექსტი |
| read_at | timestamp | წაკითხვის დრო |
| created_at | timestamp | შექმნის დრო |

### subscriptions

ხელოსნის თვიური გადასახადი.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| worker_id | uuid | ხელოსანი |
| plan | text | გეგმა |
| amount | numeric | თვიური ფასი |
| status | enum | `trial`, `active`, `past_due`, `cancelled` |
| trial_ends_at | timestamp | უფასო პერიოდის დასრულება |
| current_period_start | timestamp | მიმდინარე პერიოდის დასაწყისი |
| current_period_end | timestamp | მიმდინარე პერიოდის ბოლო |

### audit_logs

მნიშვნელოვანი მოქმედებების ისტორია.

| ველი | ტიპი | აღწერა |
| --- | --- | --- |
| id | uuid | მთავარი ID |
| actor_id | uuid | ვინ გააკეთა |
| action | text | მოქმედება |
| entity_type | text | რომელ ობიექტზე |
| entity_id | uuid | ობიექტის ID |
| metadata_json | json | დამატებითი მონაცემი |
| created_at | timestamp | დრო |

## File Storage

საჭირო storage bucket-ები:

- `profile-photos`
- `verification-documents`
- `booking-photos`
- `worker-portfolio`
- `chat-attachments`

## MVP

პირველ რეალურ ვერსიაში აუცილებელია:

- `users`
- `workers`
- `professions`
- `worker_professions`
- `worker_schedule`
- `worker_unavailable_ranges`
- `bookings`
- `booking_details`
- `messages`
- `reviews`
- `verification_documents`
- `payments`
- `disputes`
- `notifications`

მოგვიანებით შეიძლება დაემატოს:

- `subscriptions`
- `audit_logs`
- `worker_portfolio`
- referral/loyalty points
- admin moderation queue

## Backend Provider Recommendation

ამ აპისთვის ყველაზე პრაქტიკული საწყისი არჩევანი არის Supabase:

- relational schema კარგად ერგება ჯავშნებს, ჩატს, გადახდებს და სტატუსებს;
- აქვს Postgres, Auth, Storage და realtime;
- მომავალში უფრო მარტივია admin panel-ის და ანგარიშგების გაკეთება.

Firebase გამოდგება სწრაფი realtime აპისთვის, მაგრამ ამ პროექტში ბევრი კავშირიანი
მონაცემია: კლიენტი, ხელოსანი, ჯავშანი, გადახდა, დავა, შეფასება. ამიტომ relational
მონაცემთა ბაზა უფრო სუფთა იქნება.

## SQL Files

Supabase-ისთვის უკვე მომზადებულია:

- `supabase/schema.sql` - table-ები, enum-ები, index-ები, triggers და RLS enable
- `supabase/auth.sql` - Supabase Auth user-ის `public.users`-თან mapping
- `supabase/seed.sql` - საწყისი პროფესიის სია
- `supabase/profession_questions.sql` - პროფესიაზე მორგებული ჯავშნის კითხვები
- `supabase/booking_workflow.sql` - ჯავშნის status transition rules და notification trigger
- `supabase/review_workflow.sql` - review validation და rating aggregation trigger
- `supabase/payment_workflow.sql` - payment fee calculation და booking payment status sync
- `supabase/dispute_workflow.sql` - dispute/status sync, notifications და cancellation audit
- `supabase/subscription_workflow.sql` - ხელოსნის trial, subscription status sync და trial notification
- `supabase/policies.sql` - Supabase Auth-ზე მიბმული RLS policies და helper functions
- `supabase/booking_actions.sql` - official booking create/status RPC, details insert და worker notification
- `supabase/profile_actions.sql` - profile update, worker profile save/load და verification document RPC
- `supabase/review_actions.sql` - official review create/list RPC და rating aggregation trigger-ზე დაყრდნობა
- `supabase/message_actions.sql` - message send/read RPC booking parties უფლებებით
- `supabase/notification_actions.sql` - notification list/count/read-state RPC
- `supabase/payment_actions.sql` - booking fee capture/refund/summary RPC provider integration-მდე
- `supabase/dispute_actions.sql` - official dispute open RPC
- `supabase/booking_list.sql` - client/worker booking list RPC
- `supabase/public_catalog.sql` - public worker card view ტელეფონის გამოტანის გარეშე
- `supabase/storage.sql` - storage bucket-ები და საწყისი file policies
- `supabase/README.md` - ჩართვის მოკლე ინსტრუქცია
