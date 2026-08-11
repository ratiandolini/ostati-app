# Supabase Runbook

ეს არის მოკლე პრაქტიკული სია, რომ ახალ ბაზაზე ან ძველ ბაზაზე hotfix-ისას არ აირიოს
რომელი SQL როდის უნდა გაეშვას.

## Fresh Setup

ახალ Supabase project-ზე გაუშვი ამ თანმიმდევრობით:

1. `supabase/schema.sql`
2. `supabase/auth.sql`
3. `supabase/seed.sql`
4. `supabase/profession_questions.sql`
5. `supabase/booking_workflow.sql`
6. `supabase/review_workflow.sql`
7. `supabase/payment_workflow.sql`
8. `supabase/dispute_workflow.sql`
9. `supabase/subscription_workflow.sql`
10. `supabase/subscription_pricing.sql`
11. `supabase/policies.sql`
12. `supabase/booking_actions.sql`
13. `supabase/profile_actions.sql`
14. `supabase/review_actions.sql`
15. `supabase/message_actions.sql`
16. `supabase/notification_actions.sql`
17. `supabase/payment_actions.sql`
18. `supabase/dispute_actions.sql`
19. `supabase/booking_list.sql`
20. `supabase/public_catalog.sql`
21. `supabase/admin_launch_actions.sql`
22. `supabase/storage.sql`

შემდეგ შედი აპში Admin ანგარიშით და გაუშვი Supabase preflight.

## When To Run Hotfix

`supabase/hotfix_profile_admin_storage.sql` გაუშვი მხოლოდ მაშინ, თუ ძველ ბაზაზე:

- profile photo არ ინახება ან არ იხსნება;
- verification document ატვირთვაზე ჩანს `RLS` / `Unauthorized`;
- Admin ვერ ხედავს verification სურათებს signed URL-ით;
- Admin settings ან client points RPC-ებზე ჩანს ძველი schema/cache შეცდომა.

Fresh setup-ზე ეს ფაილი ჩვეულებრივ საჭირო არ არის, რადგან ძირითადი SQL-ები უკვე
ფარავს იმავე ლოგიკას.

## Notification Repair

თუ სტატუსის ცვლილებაზე notification არ მოდის, გამოიყენე:

1. `supabase/notification_actions.sql`
2. `supabase/message_actions.sql`
3. `supabase/booking_workflow.sql`
4. `supabase/booking_actions.sql`
5. `supabase/booking_list.sql`

დეტალები წერია `supabase/STATUS_NOTIFICATION_FLOW.md`-ში.

## Quick Verification

SQL-ების შემდეგ ტესტი:

1. კლიენტით შექმენი ახალი ჯავშანი.
2. ხელოსანმა დაადასტუროს, მონიშნოს `გზაშია`, `დაიწყო`, შემდეგ `დასრულდა`.
3. კლიენტმა დაადასტუროს შესრულება და შეაფასოს.
4. კლიენტის და ხელოსნის პროფილში შეცვალე ფოტო/ნომერი/მისამართი და refresh-ის შემდეგ გადაამოწმე.
5. Admin-ში გადაამოწმე booking status, audit, verification queue და settings.
6. Admin Settings-ში გადაამოწმე წესების ტექსტები: ჯავშანი, გაუქმება, კონტაქტი/კონფიდენციალურობა, დავები/დახმარება.
7. კლიენტის ჯავშნებში გახსენი `გაუქმების წესები` და გადაამოწმე, რომ Admin-ის ტექსტს აჩვენებს.
8. ატვირთე ერთი profile photo და ერთი verification document, შემდეგ Admin-იდან გახსენი.

## Production Safety

გაშვებამდე გადაამოწმე:

- `.env`-ში `REACT_APP_DATA_MODE=api` წერია.
- `.env`-ში `REACT_APP_AUTH_MODE=email_password` ან მომავალი რეალური provider წერია.
- `REACT_APP_AUTH_MODE=dev_password` არ უნდა დარჩეს production build-ში.
- Admin readiness-ში `მონაცემების რეჟიმი`, `Supabase კონფიგურაცია`, `ავტორიზაციის provider`
  და `Auth გარემო` მინიმუმ warning-ის გარეშე უნდა იყოს.
- კლიენტის მხარეს ხელოსნის ტელეფონი არ ჩანს; კომუნიკაციის მთავარი არხი ჩატია.
- Storage სურათები Admin-იდან signed URL-ით იხსნება, მაგრამ private bucket ფაილები public
  link-ით არ იხსნება.
