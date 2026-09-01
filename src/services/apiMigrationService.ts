export type ApiMigrationStatus = "connected" | "partial" | "demo";

export interface ApiMigrationItem {
  id: string;
  area: string;
  label: string;
  status: ApiMigrationStatus;
  detail: string;
  nextStep: string;
}

export const apiMigrationItems: ApiMigrationItem[] = [
  {
    id: "auth",
    area: "Auth",
    label: "შესვლა და session",
    status: "connected",
    detail: "API რეჟიმში email/password Supabase session ინახება, refresh-ზე აღდგება და logout session-ს ასუფთავებს.",
    nextStep: "Production-მდე გადაწყდეს social login/SMS provider და Supabase Email confirmation policy.",
  },
  {
    id: "worker_catalog",
    area: "Catalog",
    label: "ხელოსნების კატალოგი",
    status: "connected",
    detail: "API რეჟიმში worker_cards view-დან მოდის ტელეფონის გარეშე.",
    nextStep: "Supabase-ში public_catalog.sql უნდა იყოს გაშვებული.",
  },
  {
    id: "profiles",
    area: "Profiles",
    label: "კლიენტი/ხელოსნის პროფილი",
    status: "connected",
    detail: "კლიენტის/ხელოსნის profile load/save, ფოტო, worker settings და verification documents API რეჟიმში Supabase RPC/Storage-ზეა.",
    nextStep: "Supabase-ში profile_actions.sql-ის ბოლო ვერსია უნდა იყოს გაშვებული, რომ verification documents refresh-ზეც დაბრუნდეს.",
  },
  {
    id: "bookings",
    area: "Bookings",
    label: "ჯავშნის შექმნა და სტატუსები",
    status: "connected",
    detail: "API რეჟიმში create/list/cancel/status/client confirmation official Supabase RPC actions-ზეა და UI backend reload-ს ელოდება.",
    nextStep: "Supabase-ში booking_actions.sql, booking_list.sql და payment_workflow.sql ბოლო ვერსიებით უნდა იყოს გაშვებული.",
  },
  {
    id: "messages",
    area: "Messages",
    label: "ჩატი და unread",
    status: "connected",
    detail: "API რეჟიმში thread list, messages, attachments და read-state RPC-ებზეა.",
    nextStep: "Storage bucket chat-attachments უნდა იყოს აქტიური.",
  },
  {
    id: "notifications",
    area: "Notifications",
    label: "ნოტიფიკაციები",
    status: "connected",
    detail: "List/count/read actions API რეჟიმში Supabase RPC-ებს იყენებს.",
    nextStep: "ყველა status workflow trigger-მა notification უნდა შექმნას.",
  },
  {
    id: "reviews",
    area: "Reviews",
    label: "შეფასებები",
    status: "connected",
    detail: "შეფასების ჩაწერა, საშუალო რეიტინგი და ხელოსნის საჯარო, ანონიმური review feed RPC-ებით მუშაობს.",
    nextStep: "QA-ში duplicate review, rating aggregation და ორივე პროფილზე შეფასებების გამოჩენა შემოწმდეს.",
  },
  {
    id: "disputes",
    area: "Disputes",
    label: "დავა/პრობლემა",
    status: "connected",
    detail: "open_booking_dispute RPC უკავშირდება booking status-ს.",
    nextStep: "Admin dispute resolution real API actions ბოლომდე მიებას.",
  },
  {
    id: "payments",
    area: "Payments",
    label: "გადახდის workflow",
    status: "connected",
    detail: "MVP payment workflow API-ზეა: booking fee backend settings-იდან მოდის, hold/capture/refund/summary/audit RPC-ებით მუშაობს.",
    nextStep: "Production-მდე დაემატოს Bank of Georgia/TBC provider init და callback signature verification.",
  },
  {
    id: "admin",
    area: "Admin",
    label: "Admin settings/users/audit",
    status: "connected",
    detail: "API რეჟიმში admin identity, permissions, launch state, users, metrics, verification, booking/dispute lists/actions და backend permission checks მზადაა.",
    nextStep: "Final production cleanup: demo-only affordances, docs და launch checklist გადამოწმდეს.",
  },
  {
    id: "legal_qa",
    area: "Launch",
    label: "Rules, checklist, QA",
    status: "connected",
    detail: "API რეჟიმში rules, pre-payment checklist და Mobile QA Supabase RPC-ებით იტვირთება/ინახება.",
    nextStep: "Mobile QA სცენარები რეალურ მოწყობილობაზე გაიაროს და report-ში დადასტურდეს.",
  },
];

export const getApiMigrationSummary = () => {
  const connected = apiMigrationItems.filter(
    (item) => item.status === "connected"
  ).length;
  const partial = apiMigrationItems.filter((item) => item.status === "partial")
    .length;
  const demo = apiMigrationItems.filter((item) => item.status === "demo").length;

  return {
    connected,
    partial,
    demo,
    total: apiMigrationItems.length,
  };
};
