import type { LegalSettings, PlatformSettings } from "../../services/dataService";

type SelectOption<T extends string> = [value: T, label: string];

export const adminProviderFields: Array<{
  key: "authProvider" | "paymentProvider" | "paymentCurrency";
  label: string;
  options:
    | Array<SelectOption<PlatformSettings["authProvider"]>>
    | Array<SelectOption<PlatformSettings["paymentProvider"]>>
    | Array<SelectOption<PlatformSettings["paymentCurrency"]>>;
}> = [
  {
    key: "authProvider",
    label: "ავტორიზაცია",
    options: [
      ["demo", "Demo / 1234"],
      ["email_password", "Email + password"],
      ["sms_otp", "SMS OTP"],
    ],
  },
  {
    key: "paymentProvider",
    label: "გადახდა",
    options: [
      ["demo", "Demo escrow"],
      ["manual_mvp_hold", "Manual MVP hold"],
      ["bog", "Bank of Georgia"],
      ["tbc", "TBC"],
      ["stripe", "Stripe"],
    ],
  },
  {
    key: "paymentCurrency",
    label: "ვალუტა",
    options: [
      ["GEL", "GEL"],
      ["USD", "USD"],
      ["EUR", "EUR"],
    ],
  },
];

export const platformSettingNumberFields: Array<{
  key:
    | "bookingFee"
    | "commissionPercent"
    | "craftsmanMonthlyFee"
    | "freeTrialDays"
    | "freeCancellationHours"
    | "lateCancellationFeePercent";
  label: string;
  suffix: string;
  hint: string;
}> = [
  {
    key: "bookingFee",
    label: "ჯავშნის საფასური",
    suffix: "ლარი",
    hint: "კლიენტს ჯავშნისას დროებით ეყინება.",
  },
  {
    key: "commissionPercent",
    label: "პლატფორმის საკომისიო",
    suffix: "%",
    hint: "რეალურ გადახდებში გამოიყენება შემოსავლის დასათვლელად.",
  },
  {
    key: "craftsmanMonthlyFee",
    label: "ხელოსნის თვიური გადასახადი",
    suffix: "ლარი",
    hint: "საცდელი პერიოდის შემდეგ აქტიურობის ფასი.",
  },
  {
    key: "freeTrialDays",
    label: "უფასო საცდელი პერიოდი",
    suffix: "დღე",
    hint: "ახალი ხელოსნისთვის უფასო გამოყენების პერიოდი.",
  },
  {
    key: "freeCancellationHours",
    label: "უფასო გაუქმება",
    suffix: "საათი",
    hint: "ამ დრომდე გაუქმება ჯარიმის გარეშეა.",
  },
  {
    key: "lateCancellationFeePercent",
    label: "დაგვიანებული გაუქმების დაკავება",
    suffix: "%",
    hint: "უფასო პერიოდის შემდეგ Admin გადაამოწმებს ამ სავარაუდო დაკავებას.",
  },
];

export const legalSettingFields: Array<{
  key: keyof LegalSettings;
  label: string;
}> = [
  {
    key: "bookingRules",
    label: "ჯავშნის წესი",
  },
  {
    key: "cancellationRules",
    label: "გაუქმების წესი",
  },
  {
    key: "privacyRules",
    label: "კონტაქტი და privacy",
  },
  {
    key: "supportRules",
    label: "დავები და support",
  },
];
