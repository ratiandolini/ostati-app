import type { Booking } from "../screens/BookingsScreen";
import type { BookingStatus } from "../types";

export interface StoredRating {
  value: number;
  count: number;
}

export interface ClientPoints {
  total: number;
  history: Array<{
    id: string;
    points: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface BookingReview {
  id: string;
  bookingId: string;
  workerId: number;
  workerName: string;
  reviewerPhone?: string;
  overall: number;
  criteria: {
    quality: number;
    punctuality: number;
    cleanliness: number;
    deadline: number;
  };
  comment?: string;
  createdAt: string;
}

export interface ClientReview {
  id: string;
  bookingId: string;
  clientPhone: string;
  clientName: string;
  overall: number;
  criteria: {
    communication: number;
    timeManagement: number;
    clarity: number;
  };
  createdAt: string;
}

export interface ClientProfile {
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  city?: string;
  address?: string;
  photo?: string | null;
  accountStatus?: "active" | "limited" | "blocked";
  adminNote?: string;
  rating?: {
    value: number;
    count: number;
  };
}

export interface BookingMessage {
  id: string;
  bookingId: string;
  sender: "client" | "craftsman" | "system";
  text: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "file";
  attachmentName?: string;
}

export interface CraftsmanBookingRequest {
  id: string;
  clientName: string;
  clientPhone?: string;
  date: string;
  time: string;
  scheduledAt?: string;
  statusUpdatedAt?: string;
  address: string;
  status: BookingStatus;
  service: string;
  comment?: string;
  cancellationReason?: string;
  bookingFee?: number;
  paymentStatus?: "held" | "released" | "refunded" | "disputed";
  paymentProvider?: string;
  paymentCurrency?: string;
  paymentTransactionId?: string;
  disputeReason?: string;
  disputeDetails?: string;
  disputeStatus?: "open" | "reviewing" | "resolved";
  disputeResolution?: "refund_client" | "release_worker" | "warning" | "none";
  disputeEvidence?: Array<{
    name: string;
    url: string;
    type?: "image" | "file";
  }>;
  adminNote?: string;
  measurements?: Record<string, string | boolean | undefined>;
}

export interface BookingDispute {
  id: string;
  bookingId: string;
  reason: string;
  details: string;
  clientName?: string;
  workerName?: string;
  service?: string;
  dateLabel?: string;
  time?: string;
  amount?: number;
  paymentStatus?: "held" | "released" | "refunded" | "disputed";
  evidence?: Array<{
    name: string;
    url: string;
    type?: "image" | "file";
  }>;
  createdAt: string;
  status: "open" | "reviewing" | "resolved";
  resolution?: "refund_client" | "release_worker" | "warning" | "none";
  adminNote?: string;
  resolvedAt?: string;
}

export interface AdminAuditLog {
  id: string;
  action:
    | "verification_approved"
    | "verification_rejected"
    | "dispute_reviewing"
    | "dispute_refunded"
    | "dispute_released"
    | "dispute_warning"
    | "booking_closed"
    | "booking_refunded"
    | "payment_captured"
    | "payment_status_changed"
    | "platform_settings_updated"
    | "admin_member_updated"
    | "launch_checklist_updated"
    | "client_status_changed"
    | "craftsman_status_changed"
    | "admin_message_sent"
    | "admin_warning_sent";
  target: string;
  summary: string;
  createdAt: string;
  adminName: string;
}

export interface PlatformSettings {
  bookingFee: number;
  commissionPercent: number;
  craftsmanMonthlyFee: number;
  freeTrialDays: number;
  freeCancellationHours: number;
  lateCancellationFeePercent: number;
  authProvider: "demo" | "email_password" | "sms_otp";
  paymentProvider: "demo" | "manual_mvp_hold" | "bog" | "tbc" | "stripe";
  paymentCurrency: "GEL" | "USD" | "EUR";
  productionMode: boolean;
}

export interface LegalSettings {
  bookingRules: string;
  cancellationRules: string;
  privacyRules: string;
  supportRules: string;
}

export interface PrePaymentChecklistItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export interface MobileQaScenario {
  id: string;
  area: "client" | "craftsman" | "admin" | "mobile";
  label: string;
  detail: string;
  note?: string;
  done: boolean;
}

export interface AdminMember {
  id: string;
  name: string;
  role: "owner" | "verification" | "support" | "finance";
  permissions: Array<
    | "verification"
    | "disputes"
    | "bookings"
    | "finance"
    | "users"
    | "settings"
    | "audit"
  >;
  active: boolean;
}

export interface ClientNotification {
  id: string;
  title?: string;
  text: string;
  type: "confirmed" | "review" | "admin_message" | "admin_warning" | "account_status";
  sourceType?: string;
  bookingId?: string;
  readAt?: string | null;
  createdAt?: string;
}

export interface CraftsmanProfile {
  name?: string;
  phone?: string;
  avatar?: string;
  avatarColor?: string;
  rating?: number;
  reviewCount?: number;
  city?: string;
  role?: string;
  experienceYears?: number;
  professions?: string[];
  extraWorkComment?: string;
  verification?: {
    idFront: boolean;
    idBack: boolean;
    bankAccount: boolean;
  };
  verificationDocuments?: {
    idFront?: string;
    idBack?: string;
    bankAccount?: string;
  };
  verificationStatus?: "not_submitted" | "pending" | "verified" | "rejected";
  verificationNote?: string;
  accountStatus?: "active" | "limited" | "blocked";
  adminNote?: string;
  price?: string;
  schedule?: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface UnavailableRange {
  start: string;
  end: string;
}

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = safeParseJson(raw);
    if (parsed === undefined) {
      window.localStorage.removeItem(key);
      return fallback;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const emitAppDataEvent = (name: string, detail?: unknown) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
  window.dispatchEvent(new CustomEvent("app-data-updated", { detail: { name, detail } }));
};

const normalizeRating = (value: number) => Number(value.toFixed(1));

const defaultPlatformSettings: PlatformSettings = {
  bookingFee: 15,
  commissionPercent: 10,
  craftsmanMonthlyFee: 29,
  freeTrialDays: 14,
  freeCancellationHours: 12,
  lateCancellationFeePercent: 30,
  authProvider: "email_password",
  paymentProvider: "manual_mvp_hold",
  paymentCurrency: "GEL",
  productionMode: false,
};

const defaultLegalSettings: LegalSettings = {
  bookingRules:
    "ჯავშნისას კლიენტის ჯავშნის საფასური დროებით იყინება. ხელოსანს თანხა არ ერიცხება, სანამ სამუშაო არ დასრულდება და კლიენტი შესრულებას არ დაადასტურებს.",
  cancellationRules:
    "უფასო გაუქმება შესაძლებელია ვიზიტამდე მითითებული დროით ადრე. ამ დროის შემდეგ გაუქმებას Admin გადაამოწმებს და თანხის შესაძლო დაკავება/დაბრუნება გადაწყდება მიზეზისა და ჯავშნის ისტორიის მიხედვით. დაგვიანება ან შეთანხმების დარღვევა აისახება რეიტინგსა და ანგარიშზე.",
  privacyRules:
    "ტელეფონის ნომერი და პირადი დეტალები არ ჩანს, სანამ სისტემა უსაფრთხო ეტაპს არ დაადასტურებს. ძირითადი კომუნიკაცია ჩატში რჩება, რათა შეთანხმებები, დაგვიანებები და მტკიცებულებები ერთ ადგილზე იყოს.",
  supportRules:
    "დავა იხსნება ჯავშნიდან ან ჩატიდან პრობლემის აღწერით. Admin ამოწმებს ჯავშნის დეტალებს, მიმოწერას, სტატუსების ისტორიას, ატვირთულ მტკიცებულებებს და თანხის მდგომარეობას, შემდეგ იღებს გადაწყვეტილებას დაბრუნებაზე, ხელოსანზე თანხის გაშვებაზე ან გაფრთხილებაზე.",
};

const defaultPrePaymentChecklist: PrePaymentChecklistItem[] = [
  {
    id: "auth",
    label: "ავტორიზაცია და პროფილები",
    detail: "კლიენტი, ხელოსანი და Admin ცალ-ცალკე შედიან და ინახავენ პროფილს.",
    done: true,
  },
  {
    id: "booking_flow",
    label: "ჯავშნის სრული სტატუსები",
    detail: "მოლოდინში -> დადასტურებული -> გზაშია -> დაიწყო -> დასრულდა -> დახურული.",
    done: true,
  },
  {
    id: "chat",
    label: "ჩატი და წაუკითხავი მესიჯები",
    detail: "ჯავშანზე მიბმული მიმოწერა, დრო, თარიღი, ფაილის/ფოტოს ატვირთვა.",
    done: true,
  },
  {
    id: "verification",
    label: "ხელოსნის ვერიფიკაცია",
    detail: "პირადობის წინა/უკანა მხარე და ანგარიშის დოკუმენტი Admin-ის დასადასტურებლად.",
    done: true,
  },
  {
    id: "reviews",
    label: "ორმხრივი შეფასებები",
    detail: "კლიენტი აფასებს ხელოსანს, ხელოსანი აფასებს კლიენტს დასრულების შემდეგ.",
    done: true,
  },
  {
    id: "rules",
    label: "წესები და cancellation პოლიტიკა",
    detail: "კლიენტისა და ხელოსნისთვის გასაგები წესები Admin-იდან სამართავად.",
    done: false,
  },
  {
    id: "supabase",
    label: "Supabase API რეჟიმის დასრულება",
    detail: "core API ფენები მიბმულია Supabase RPC/storage ნაკადზე.",
    done: true,
  },
  {
    id: "qa",
    label: "მობილური QA და სცენარების ტესტი",
    detail: "კლიენტი/ხელოსანი/Admin ძირითადი გზები უნდა გაიაროს მობილურზე.",
    done: false,
  },
];

const defaultMobileQaScenarios: MobileQaScenario[] = [
  {
    id: "client_booking",
    area: "client",
    label: "კლიენტი ჯავშნის ხელოსანს",
    detail:
      "კლიენტი პოულობს ხელოსანს, ირჩევს დღეს/საათს, ავსებს დეტალებს და ხედავს ჯავშნის სტატუსს.",
    done: false,
  },
  {
    id: "client_cancel",
    area: "client",
    label: "კლიენტი აუქმებს მიზეზით",
    detail:
      "გაუქმებისას ჩანს გაფრთხილება, მიზეზების არჩევა და ჯავშანი გადადის სწორ სტატუსში.",
    done: false,
  },
  {
    id: "worker_status_flow",
    area: "craftsman",
    label: "ხელოსანი მართავს სამუშაოს სტატუსებს",
    detail:
      "მოლოდინში -> დადასტურებული -> გზაშია -> დაიწყო -> დასრულდა მუშაობს და refresh-ის შემდეგ არ იკარგება.",
    done: false,
  },
  {
    id: "chat_unread",
    area: "client",
    label: "ჩატი და unread badge",
    detail:
      "მესიჯი ჩანს ორივე მხარეს, წაკითხვის შემდეგ unread ციფრი ქრება, ფოტო/ფაილი ჩანს სწორად.",
    done: false,
  },
  {
    id: "mobile_reviews",
    area: "client",
    label: "ორმხრივი შეფასება",
    detail:
      "დასრულების შემდეგ კლიენტი აფასებს ხელოსანს, ხელოსანი აფასებს კლიენტს და ქარდები იხურება.",
    done: false,
  },
  {
    id: "profile_storage",
    area: "mobile",
    label: "პროფილი, ფოტო და შენახვა",
    detail:
      "კლიენტის და ხელოსნის პროფილში ფოტო/სახელი/მისამართი/ნომერი ინახება, refresh-ის შემდეგ არ იკარგება.",
    done: false,
  },
  {
    id: "verification_lock",
    area: "admin",
    label: "ვერიფიკაციამდე ხელოსანი დაბლოკილია",
    detail:
      "დოკუმენტების ატვირთვამდე სამუშაო ადგილი არ იხსნება; Admin ხედავს დოკუმენტებს და ამტკიცებს/უარყოფს.",
    done: false,
  },
  {
    id: "admin_dispute",
    area: "admin",
    label: "Admin ამუშავებს დავას",
    detail:
      "პრობლემის გახსნისას Admin ხედავს მიზეზს, ჩანაწერს, თანხის სტატუსს და audit log-ს.",
    done: false,
  },
  {
    id: "mobile_layout",
    area: "mobile",
    label: "მობილური ეკრანი არ იშლება",
    detail:
      "ქვედა მენიუ, ფილტრები, ქარდები, modal-ები და Admin tabs არ ფარავს ტექსტს პატარა ეკრანზე.",
    done: false,
  },
];

const defaultAdminMembers: AdminMember[] = [
  {
    id: "owner",
    name: "მფლობელი",
    role: "owner",
    permissions: [
      "verification",
      "disputes",
      "bookings",
      "finance",
      "users",
      "settings",
      "audit",
    ],
    active: true,
  },
  {
    id: "verification",
    name: "ვერიფიკაციის ოპერატორი",
    role: "verification",
    permissions: ["verification", "audit"],
    active: true,
  },
  {
    id: "support",
    name: "დახმარების ოპერატორი",
    role: "support",
    permissions: ["disputes", "bookings", "users", "audit"],
    active: true,
  },
  {
    id: "finance",
    name: "ფინანსები",
    role: "finance",
    permissions: ["finance", "disputes", "audit"],
    active: true,
  },
];

export const appStorage = {
  getPlatformSettings(): PlatformSettings {
    return {
      ...defaultPlatformSettings,
      ...readJson<Partial<PlatformSettings>>("platformSettings", {}),
    };
  },

  savePlatformSettings(settings: PlatformSettings) {
    writeJson("platformSettings", settings);
    emitAppDataEvent("platform-settings-updated", settings);
  },

  getLegalSettings(): LegalSettings {
    return {
      ...defaultLegalSettings,
      ...readJson<Partial<LegalSettings>>("legalSettings", {}),
    };
  },

  saveLegalSettings(settings: LegalSettings) {
    writeJson("legalSettings", settings);
    emitAppDataEvent("platform-settings-updated", settings);
  },

  getPrePaymentChecklist(): PrePaymentChecklistItem[] {
    const stored = readJson<PrePaymentChecklistItem[] | null>(
      "prePaymentChecklist",
      null
    );
    if (!stored) return defaultPrePaymentChecklist;
    const storedById = new Map(stored.map((item) => [item.id, item]));
    return defaultPrePaymentChecklist.map((item) => ({
      ...item,
      ...storedById.get(item.id),
    }));
  },

  savePrePaymentChecklist(items: PrePaymentChecklistItem[]) {
    writeJson("prePaymentChecklist", items);
  },

  updatePrePaymentChecklistItem(id: string, done: boolean) {
    this.savePrePaymentChecklist(
      this.getPrePaymentChecklist().map((item) =>
        item.id === id ? { ...item, done } : item
      )
    );
  },

  getMobileQaScenarios(): MobileQaScenario[] {
    const stored = readJson<MobileQaScenario[] | null>("mobileQaScenarios", null);
    if (!stored) return defaultMobileQaScenarios;
    const storedById = new Map(stored.map((item) => [item.id, item]));
    return defaultMobileQaScenarios.map((item) => ({
      ...item,
      ...storedById.get(item.id),
    }));
  },

  saveMobileQaScenarios(items: MobileQaScenario[]) {
    writeJson("mobileQaScenarios", items);
  },

  updateMobileQaScenario(id: string, done: boolean) {
    const next = this.getMobileQaScenarios().map((item) =>
      item.id === id ? { ...item, done } : item
    );
    this.saveMobileQaScenarios(next);
    this.updatePrePaymentChecklistItem(
      "qa",
      next.length > 0 && next.every((item) => item.done)
    );
  },

  updateMobileQaScenarioNote(id: string, note: string) {
    this.saveMobileQaScenarios(
      this.getMobileQaScenarios().map((item) =>
        item.id === id ? { ...item, note } : item
      )
    );
  },

  getAdminMembers(): AdminMember[] {
    return readJson<AdminMember[]>("adminMembers", defaultAdminMembers);
  },

  saveAdminMembers(members: AdminMember[]) {
    writeJson("adminMembers", members);
  },

  updateAdminMember(id: string, updater: (member: AdminMember) => AdminMember) {
    this.saveAdminMembers(
      this.getAdminMembers().map((member) =>
        member.id === id ? updater(member) : member
      )
    );
  },

  getClientProfile(phone: string): ClientProfile {
    return readJson<ClientProfile>(`clientProfile:${phone}`, {});
  },

  saveClientProfile(phone: string, profile: ClientProfile) {
    writeJson(`clientProfile:${phone}`, profile);
  },

  getClientBookings(): Booking[] {
    return readJson<Booking[]>("clientBookings", []);
  },

  saveClientBookings(bookings: Booking[]) {
    writeJson("clientBookings", bookings);
    emitAppDataEvent("client-bookings-updated");
  },

  updateClientBooking(
    id: string,
    updater: (booking: Booking) => Booking
  ) {
    this.saveClientBookings(
      this.getClientBookings().map((booking) =>
        booking.id === id ? updater(booking) : booking
      )
    );
  },

  updateClientProfilesByPhone(
    phones: string[],
    updater: (profile: ClientProfile, phone: string) => ClientProfile
  ) {
    phones.forEach((phone) => {
      this.saveClientProfile(phone, updater(this.getClientProfile(phone), phone));
    });
  },

  getCraftsmanRequests(): CraftsmanBookingRequest[] {
    return readJson<CraftsmanBookingRequest[]>("craftsmanBookingRequests", []);
  },

  saveCraftsmanRequests(requests: CraftsmanBookingRequest[]) {
    writeJson("craftsmanBookingRequests", requests);
    emitAppDataEvent("craftsman-bookings-updated");
  },

  getRealCraftsmanRequests(): CraftsmanBookingRequest[] {
    return this.getCraftsmanRequests().filter((request) =>
      Boolean(request.id) && !/^კლიენტი(\s|$)/.test(request.clientName || "")
    );
  },

  pruneDemoCraftsmanRequests() {
    const realRequests = this.getRealCraftsmanRequests();
    this.saveCraftsmanRequests(realRequests);
    return realRequests;
  },

  prependCraftsmanRequest(request: CraftsmanBookingRequest) {
    this.saveCraftsmanRequests([request, ...this.getCraftsmanRequests()]);
  },

  updateCraftsmanRequest(
    id: string,
    updater: (request: CraftsmanBookingRequest) => CraftsmanBookingRequest
  ) {
    this.saveCraftsmanRequests(
      this.getCraftsmanRequests().map((request) =>
        request.id === id ? updater(request) : request
      )
    );
  },

  updateCraftsmanRequestStatus(id: string, status: BookingStatus) {
    this.saveCraftsmanRequests(
      this.getCraftsmanRequests().map((request) =>
        request.id === id ? { ...request, status } : request
      )
    );
  },

  getBookingMessages(): BookingMessage[] {
    return readJson<BookingMessage[]>("bookingMessages", []);
  },

  saveBookingMessages(messages: BookingMessage[]) {
    writeJson("bookingMessages", messages);
  },

  getMessageReads(role: "client" | "craftsman"): Record<string, string> {
    return readJson<Record<string, string>>(`messageReads:${role}`, {});
  },

  markThreadRead(
    role: "client" | "craftsman",
    threadId: string,
    lastMessageAt: string
  ) {
    writeJson(`messageReads:${role}`, {
      ...this.getMessageReads(role),
      [threadId]: lastMessageAt,
    });
  },

  getBookingDisputes(): BookingDispute[] {
    return readJson<BookingDispute[]>("bookingDisputes", []);
  },

  saveBookingDisputes(disputes: BookingDispute[]) {
    writeJson("bookingDisputes", disputes);
  },

  prependBookingDispute(dispute: BookingDispute) {
    this.saveBookingDisputes([dispute, ...this.getBookingDisputes()]);
  },

  updateBookingDispute(
    id: string,
    updater: (dispute: BookingDispute) => BookingDispute
  ) {
    this.saveBookingDisputes(
      this.getBookingDisputes().map((dispute) =>
        dispute.id === id ? updater(dispute) : dispute
      )
    );
  },

  getAdminAuditLogs(): AdminAuditLog[] {
    return readJson<AdminAuditLog[]>("adminAuditLogs", []);
  },

  saveAdminAuditLogs(logs: AdminAuditLog[]) {
    writeJson("adminAuditLogs", logs);
  },

  prependAdminAuditLog(log: Omit<AdminAuditLog, "id" | "createdAt">) {
    this.saveAdminAuditLogs([
      {
        ...log,
        id: `${Date.now()}-${log.action}`,
        createdAt: new Date().toISOString(),
      },
      ...this.getAdminAuditLogs(),
    ].slice(0, 80));
  },

  getReviewedBookingIds(): string[] {
    return readJson<string[]>("reviewedBookingIds", []);
  },

  saveReviewedBookingIds(ids: string[]) {
    writeJson("reviewedBookingIds", ids);
  },

  getWorkerRating(workerId: number): StoredRating | null {
    return readJson<StoredRating | null>(`workerRating:${workerId}`, null);
  },

  addWorkerRating(
    workerId: number,
    currentRating: number,
    currentCount: number,
    score: number
  ): StoredRating {
    const stored = this.getWorkerRating(workerId);
    const baseRating = stored?.value ?? currentRating;
    const baseCount = stored?.count ?? currentCount;
    const nextCount = baseCount + 1;
    const nextValue = normalizeRating(
      (baseRating * baseCount + score) / nextCount
    );
    const next = { value: nextValue, count: nextCount };
    writeJson(`workerRating:${workerId}`, next);
    this.saveClientBookings(
      this.getClientBookings().map((booking) =>
        booking.worker.id === workerId
          ? {
              ...booking,
              worker: {
                ...booking.worker,
                rating: next.value,
                reviewCount: next.count,
              },
            }
          : booking
      )
    );
    return next;
  },

  getBookingReviews(): BookingReview[] {
    return readJson<BookingReview[]>("bookingReviews", []);
  },

  prependBookingReview(review: Omit<BookingReview, "id" | "createdAt">) {
    const nextReview: BookingReview = {
      ...review,
      id: `${review.bookingId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    writeJson("bookingReviews", [nextReview, ...this.getBookingReviews()].slice(0, 80));
    return nextReview;
  },

  getWorkerReviews(workerId: number): BookingReview[] {
    return this.getBookingReviews().filter((review) => review.workerId === workerId);
  },

  getClientRating(phone: string): StoredRating {
    return readJson<StoredRating>(`clientRating:${phone}`, { value: 5, count: 0 });
  },

  addClientRating(phone: string, score: number): StoredRating {
    const current = this.getClientRating(phone);
    const nextCount = current.count + 1;
    const nextValue = normalizeRating(
      (current.value * current.count + score) / nextCount
    );
    const next = { value: nextValue, count: nextCount };
    writeJson(`clientRating:${phone}`, next);
    return next;
  },

  getClientReviews(phone: string): ClientReview[] {
    return readJson<ClientReview[]>(`clientReviews:${phone}`, []);
  },

  prependClientReview(review: Omit<ClientReview, "id" | "createdAt">) {
    const nextReview: ClientReview = {
      ...review,
      id: `${review.bookingId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    writeJson(
      `clientReviews:${review.clientPhone}`,
      [nextReview, ...this.getClientReviews(review.clientPhone)].slice(0, 80)
    );
    return nextReview;
  },

  getClientPoints(phone: string): ClientPoints {
    return readJson<ClientPoints>(`clientPoints:${phone}`, {
      total: 0,
      history: [],
    });
  },

  addClientPoints(phone: string, points: number, reason: string): ClientPoints {
    const current = this.getClientPoints(phone);
    const next = {
      total: current.total + points,
      history: [
        {
          id: `${Date.now()}-${points}`,
          points,
          reason,
          createdAt: new Date().toISOString(),
        },
        ...current.history,
      ].slice(0, 20),
    };
    writeJson(`clientPoints:${phone}`, next);
    return next;
  },

  getClientNotifications(): ClientNotification[] {
    return readJson<ClientNotification[]>("clientNotifications", []);
  },

  saveClientNotifications(notifications: ClientNotification[]) {
    writeJson("clientNotifications", notifications);
    emitAppDataEvent("client-notifications-updated");
  },

  prependClientNotification(notification: ClientNotification) {
    this.saveClientNotifications([
      notification,
      ...this.getClientNotifications(),
    ]);
    emitAppDataEvent("booking-status-updated", {
      bookingId: notification.bookingId,
      target: "client",
    });
  },

  getCraftsmanNotifications(): ClientNotification[] {
    return readJson<ClientNotification[]>("craftsmanNotifications", []);
  },

  saveCraftsmanNotifications(notifications: ClientNotification[]) {
    writeJson("craftsmanNotifications", notifications);
    emitAppDataEvent("craftsman-notifications-updated");
  },

  prependCraftsmanNotification(notification: ClientNotification) {
    this.saveCraftsmanNotifications([
      notification,
      ...this.getCraftsmanNotifications(),
    ]);
    emitAppDataEvent("booking-status-updated", {
      bookingId: notification.bookingId,
      target: "craftsman",
    });
  },

  getCraftsmanProfile(): CraftsmanProfile {
    return readJson<CraftsmanProfile>("craftsmanProfile", {});
  },

  saveCraftsmanProfile(profile: CraftsmanProfile) {
    writeJson("craftsmanProfile", profile);
  },

  rememberPhone(role: "client" | "craftsman", phone: string) {
    window.localStorage.setItem(`rememberedPhone:${role}`, phone);
  },

  getRememberedPhone(role: "client" | "craftsman"): string {
    return window.localStorage.getItem(`rememberedPhone:${role}`) || "";
  },

  getCraftsmanTrialStart(): string {
    const stored = window.localStorage.getItem("craftsmanTrialStart");
    if (stored) return stored;
    const next = new Date().toISOString();
    window.localStorage.setItem("craftsmanTrialStart", next);
    return next;
  },

  getCraftsmanUnavailableRanges(): UnavailableRange[] {
    return readJson<UnavailableRange[]>("craftsmanUnavailableRanges", []);
  },

  saveCraftsmanUnavailableRanges(ranges: UnavailableRange[]) {
    writeJson("craftsmanUnavailableRanges", ranges);
  },
};
