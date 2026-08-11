import type { BookingStatus } from "../../types";
import type { MobileQaScenario } from "../../services/dataService";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";

export const bookingStatusPriority: Record<BookingStatus, number> = {
  disputed: 6,
  pending: 5,
  confirmed: 4,
  en_route: 3,
  started: 3,
  worker_completed: 2,
  client_confirmed: 1,
  closed: 0,
  completed: 0,
  declined: 0,
  cancelled: 0,
};

export const qaAreaLabel: Record<MobileQaScenario["area"], string> = {
  client: "კლიენტი",
  craftsman: "ხელოსანი",
  admin: "Admin",
  mobile: "მობილური UI",
};

export const qaAreaOrder: MobileQaScenario["area"][] = [
  "client",
  "craftsman",
  "admin",
  "mobile",
];

export const mobileQaTestGuide: Record<
  string,
  { steps: string[]; expected: string }
> = {
  client_booking: {
    steps: [
      "კლიენტით შედი მთავარზე და მოძებნე ხელოსანი",
      "აირჩიე ხელმისაწვდომი დღე/საათი; დღევანდელ თარიღზე წარსული დრო არ უნდა ჩანდეს",
      "შეავსე სავალდებულო მისამართი და პროფესიის მიხედვით დეტალები",
      "დაადასტურე ჯავშანი და გახსენი ჯავშნების tab",
    ],
    expected:
      "ჯავშანი ჩანს მოლოდინში, თარიღი ქართულად/24-საათიანად წერია, ტელეფონი არ ჩანს და ხელოსანს მისდის ახალი მოთხოვნა.",
  },
  client_cancel: {
    steps: [
      "კლიენტის ჯავშნებში გახსენი აქტიური ჯავშანი",
      "დააჭირე გაუქმებას, აირჩიე მიზეზი და დაადასტურე",
      "შეამოწმე შეტყობინება და ჯავშნის ფერი/status",
    ],
    expected:
      "გაუქმებული ჯავშანი განსხვავებული ფერით ჩანს და მიზეზი Admin/ისტორიაში იკითხება.",
  },
  worker_status_flow: {
    steps: [
      "ხელოსნით გახსენი შემოსული მოთხოვნა",
      "დაადასტურე, მონიშნე გზაშია, დაიწყო და დასრულდა",
      "refresh-ის ან tab-ების შეცვლის შემდეგ გადაამოწმე იგივე status",
    ],
    expected:
      "status არ იკარგება, კლიენტს notification მისდის, ხელოსანს საკუთარ ქმედებაზე დუბლირებული notification არ მოსდის და დასრულება review flow-ს ხსნის.",
  },
  chat_unread: {
    steps: [
      "კლიენტიდან გაუგზავნე მესიჯი ხელოსანს",
      "ხელოსნის მხარეს შეამოწმე unread badge და ბოლო ტექსტი",
      "გახსენი ჩატი და დაბრუნდი სიაში",
    ],
    expected:
      "წაკითხვის შემდეგ unread ციფრი ქრება, თარიღი/დრო ჩანს და ბოლო მესიჯი სწორია.",
  },
  mobile_reviews: {
    steps: [
      "ხელოსანმა მონიშნოს სამუშაო დასრულებულად",
      "კლიენტმა დაადასტუროს დასრულება და შეავსოს ვარსკვლავები",
      "ხელოსანმაც შეაფასოს კლიენტი",
    ],
    expected:
      "ორივე შეფასება ერთხელ იწერება, ქარდი სრულდება და რეიტინგები ახლდება.",
  },
  profile_storage: {
    steps: [
      "კლიენტის პროფილში შეცვალე სახელი, ნომერი, საცხოვრებელი მისამართი და ფოტო",
      "შენახვის შემდეგ refresh გააკეთე და იგივე მონაცემები გადაამოწმე",
      "ხელოსნის პროფილში შეცვალე ფოტო, პროფესია, სტაჟი, ნომერი და სამუშაო საათები",
      "ხელოსანზეც refresh-ის შემდეგ გადაამოწმე იგივე მონაცემები",
    ],
    expected:
      "შენახვის ღილაკი ცვლილებამდე ფერმკრთალია, ცვლილების შემდეგ აქტიურდება, ფოტო/ველები refresh-ის შემდეგ არ იკარგება.",
  },
  verification_lock: {
    steps: [
      "ხელოსნის პროფილში ატვირთე პირადობის წინა/უკანა მხარე",
      "შეიყვანე ანგარიშის ნომერი და გაგზავნე ვერიფიკაცია",
      "Admin-ით გახსენი ვერიფიკაცია და დაადასტურე ან უარყავი",
    ],
    expected:
      "დადასტურებამდე ხელოსნის სამუშაო ადგილი დაბლოკილია, დადასტურების შემდეგ იხსნება.",
  },
  admin_dispute: {
    steps: [
      "კლიენტის ან ხელოსნის მხრიდან გახსენი პრობლემა ჯავშანზე",
      "Admin-ში გახსენი დავები და მონიშნე განხილვაში",
      "ჩაწერე მიზეზი და გადაწყვიტე დახურვა/დაბრუნება/გაუქმება",
    ],
    expected:
      "დავა იცვლის status-ს, თანხის მდგომარეობა სწორია და audit log-ში ჩანაწერი ჩნდება.",
  },
  mobile_layout: {
    steps: [
      "გახსენი ყველა მთავარი tab პატარა ეკრანზე",
      "შეამოწმე card-ები, dropdown-ები, bottom nav და modal-ები",
      "გრძელი ქართული ტექსტებით სცადე overflow",
    ],
    expected:
      "ტექსტები არ ედება ერთმანეთს, ღილაკები ჯდება frame-ში, bottom nav არ ფარავს კონტენტს და გვერდი თავისით არ ციმციმებს.",
  },
};

export const apiMigrationStatusUi = {
  connected: {
    label: "მიერთებულია",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#047857",
  },
  partial: {
    label: "ნაწილობრივია",
    bg: "#fff7ed",
    border: "#fed7aa",
    color: "#c2410c",
  },
  demo: {
    label: "demo fallback",
    bg: "#fef2f2",
    border: "#fecaca",
    color: "#b91c1c",
  },
} as const;

export const preflightStatusUi: Record<
  SupabasePreflightCheck["status"],
  { label: string; bg: string; border: string; color: string }
> = {
  ok: {
    label: "კარგია",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#047857",
  },
  warning: {
    label: "საყურადღებო",
    bg: "#fff7ed",
    border: "#fed7aa",
    color: "#c2410c",
  },
  error: {
    label: "შეცდომა",
    bg: "#fef2f2",
    border: "#fecaca",
    color: "#b91c1c",
  },
};
