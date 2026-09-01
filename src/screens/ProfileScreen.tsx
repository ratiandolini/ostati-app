import React, { useEffect, useMemo, useRef, useState } from "react";
import { Worker } from "../types";
import { dataService, isDemoDataMode } from "../services/dataService";
import { getBookingQuestionFields } from "../services/professionQuestions";
import { bookingDetailsSchema, getValidationMessage } from "../services/validation";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { loadWorkerPortfolio, PortfolioItem } from "../services/marketplaceApiService";
import { loadWorkerPublicReviews, PublicWorkerReview } from "../services/reviewApiService";

interface ProfileScreenProps {
  worker: Worker;
  onBack: () => void;
  onBooked: (
    worker: Worker,
    day: number,
    time: string,
    dateLabel: string,
    details: BookingDetails
  ) => void | Promise<void>;
  hasBooked: boolean;
  onOpenMessages: () => void;
}

export interface BookingDetails {
  comment: string;
  visitAddress: string;
  scheduledAt?: string;
  area: string;
  height: string;
  length: string;
  rooms: string;
  extraMeasurements: string;
  wallCondition: string;
  targetSurface: string;
  materialOwner: string;
  plumbingType: string;
  floor: string;
  electricPoints: string;
  electricPanel: string;
  isEmergency: string;
  workScope: string;
  surfaceType: string;
  materialNote: string;
  itemCount: string;
  currentCondition: string;
  photoNote: string;
  sitePhoto: string;
  roofType: string;
}

const dayNames = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];
const monthNames = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];
const baseTimes = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const minimumBookingLeadMinutes = 60;

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const timeToMinutes = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const minutesToTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getScheduleTimes = (worker: Worker, date: Date) => {
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  const schedule = worker.schedule?.find((item) => item.weekday === weekday);
  if (!schedule) return worker.schedule?.length ? [] : baseTimes;
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return worker.schedule?.length ? [] : baseTimes;
  }
  const slots: string[] = [];
  for (let minutes = start; minutes < end; minutes += 60) {
    slots.push(minutesToTime(minutes));
  }
  return slots.length ? slots : worker.schedule?.length ? [] : baseTimes;
};

const getAvailableTimes = (worker: Worker, date: Date) => {
  const dateKey = toDateKey(date);
  const booked = new Set(worker.bookedSlots || []);
  return getScheduleTimes(worker, date).filter(
    (time) => !booked.has(`${dateKey}T${time}`) && !booked.has(`${dateKey} ${time}`)
  );
};

const isSameDate = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);

const getMinimumBookableMinutes = (date: Date) => {
  const now = new Date();
  if (!isSameDate(date, now)) return 0;
  return now.getHours() * 60 + now.getMinutes() + minimumBookingLeadMinutes;
};

const MAX_SITE_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_SITE_PHOTO_SIDE = 1200;

const readUnavailableRanges = () => {
  return dataService.getCraftsmanUnavailableRanges();
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  worker,
  onBack,
  onBooked,
  hasBooked,
  onOpenMessages,
}) => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [activePortfolioItem, setActivePortfolioItem] = useState<PortfolioItem | null>(null);
  const [workerReviews, setWorkerReviews] = useState<PublicWorkerReview[]>([]);
  const today = startOfDay(new Date());
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  useEffect(() => {
    if (!isDemoDataMode && !worker.backendId) { setPortfolio([]); return; }
    const controller = new AbortController();
    loadWorkerPortfolio(worker.backendId || "demo-worker", controller.signal).then(setPortfolio).catch(() => setPortfolio([]));
    return () => controller.abort();
  }, [worker.backendId]);
  useEffect(() => {
    if (isDemoDataMode) {
      setWorkerReviews(dataService.getWorkerReviews(worker.id));
      return;
    }
    if (!worker.backendId) {
      setWorkerReviews([]);
      return;
    }

    const controller = new AbortController();
    loadWorkerPublicReviews(worker.backendId, controller.signal)
      .then(setWorkerReviews)
      .catch(() => setWorkerReviews([]));
    return () => controller.abort();
  }, [worker.backendId, worker.id]);
  const [selectedTime, setSelectedTime] = useState("");
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [showBookingRules, setShowBookingRules] = useState(false);
  const [sitePhotoError, setSitePhotoError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSubmitError, setBookingSubmitError] = useState("");
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    comment: "",
    visitAddress: "",
    area: "",
    height: "",
    length: "",
    rooms: "",
    extraMeasurements: "",
    wallCondition: "",
    targetSurface: "",
    materialOwner: "",
    plumbingType: "",
    floor: "",
    electricPoints: "",
    electricPanel: "",
    isEmergency: "",
    workScope: "",
    surfaceType: "",
    materialNote: "",
    itemCount: "",
    currentCondition: "",
    photoNote: "",
    sitePhoto: "",
    roofType: "",
  });
  const timesRef = useRef<HTMLElement | null>(null);
  const unavailableRanges = useMemo(
    () => worker.unavailableRanges || readUnavailableRanges(),
    [worker.unavailableRanges]
  );

  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate();
  const mondayOffset =
    (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() +
      6) %
    7;
  const monthLabel = `${monthNames[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  const selectedDateLabel = `${selectedDate.getDate()} ${
    monthNames[selectedDate.getMonth()]
  } ${selectedDate.getFullYear()}`;

  const isUnavailable = (date: Date) => {
    const key = toDateKey(date);
    const rangeBusy = unavailableRanges.some(
      (range) => key >= range.start && key <= range.end
    );
    const legacyBusy =
      date.getMonth() === today.getMonth() && worker.busyDays.includes(date.getDate());
    return rangeBusy || legacyBusy;
  };

  useEffect(() => {
    if (selectedDate >= today && !isUnavailable(selectedDate)) return;

    for (let offset = 0; offset < 120; offset += 1) {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + offset);
      if (!isUnavailable(candidate)) {
        setSelectedDate(candidate);
        setVisibleMonth(new Date(candidate.getFullYear(), candidate.getMonth(), 1));
        setSelectedTime("");
        return;
      }
    }
  }, [selectedDate, worker.id]);

  const availableTimes = useMemo(
    () =>
      getAvailableTimes(worker, selectedDate).filter(
        (time) => timeToMinutes(time) >= getMinimumBookableMinutes(selectedDate)
      ),
    [worker, selectedDate]
  );
  useEffect(() => {
    if (selectedTime && !availableTimes.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [availableTimes, selectedTime]);
  const workerProfessionText = worker.skills?.length
    ? worker.skills.join(" · ")
    : worker.role;
  const { platformSettings, legalSettings } = usePlatformSettings();
  const reviewAverages = useMemo(() => {
    if (!workerReviews.length) {
      return {
        quality: worker.rating,
        punctuality: worker.rating,
        cleanliness: worker.rating,
        deadline: worker.rating,
      };
    }
    const sum = workerReviews.reduce(
      (next, review) => ({
        quality: next.quality + review.criteria.quality,
        punctuality: next.punctuality + review.criteria.punctuality,
        cleanliness: next.cleanliness + review.criteria.cleanliness,
        deadline: next.deadline + review.criteria.deadline,
      }),
      { quality: 0, punctuality: 0, cleanliness: 0, deadline: 0 }
    );
    return {
      quality: Number((sum.quality / workerReviews.length).toFixed(1)),
      punctuality: Number((sum.punctuality / workerReviews.length).toFixed(1)),
      cleanliness: Number((sum.cleanliness / workerReviews.length).toFixed(1)),
      deadline: Number((sum.deadline / workerReviews.length).toFixed(1)),
    };
  }, [worker.rating, workerReviews]);
  const professionQuestions = useMemo(() => {
    return getBookingQuestionFields(worker.role);
  }, [worker.role]);

  const shiftMonth = (offset: number) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
    setSelectedTime("");
  };

  const chooseDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime("");
    setBookingSubmitError("");
    window.setTimeout(() => {
      timesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleSitePhotoUpload = (file: File) => {
    setSitePhotoError("");
    if (!file.type.startsWith("image/")) {
      setSitePhotoError("ატვირთეთ მხოლოდ ფოტო.");
      return;
    }
    if (file.size > MAX_SITE_PHOTO_BYTES) {
      setSitePhotoError("ფოტო ძალიან დიდია. აირჩიეთ მაქსიმუმ 6MB ზომის ფოტო.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const source = typeof reader.result === "string" ? reader.result : "";
      if (!source) return;
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(
          1,
          MAX_SITE_PHOTO_SIDE / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          setSitePhotoError("ფოტოს დამუშავება ვერ მოხერხდა.");
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setBookingDetails((prev) => ({
          ...prev,
          sitePhoto: canvas.toDataURL("image/jpeg", 0.78),
        }));
      };
      image.onerror = () => {
        setSitePhotoError("ფოტოს წაკითხვა ვერ მოხერხდა.");
      };
      image.src = source;
    };
    reader.onerror = () => {
      setSitePhotoError("ფოტოს ატვირთვა ვერ მოხერხდა.");
    };
    reader.readAsDataURL(file);
  };

  const submitBooking = async () => {
    if (bookingSubmitting || !selectedTime) return;
    setBookingSubmitError("");

    const validation = bookingDetailsSchema.safeParse(bookingDetails);

    if (!validation.success) {
      setBookingSubmitError(
        getValidationMessage(validation.error, "მიუთითე მისამართი, სადაც ხელოსანი უნდა მოვიდეს.")
      );
      return;
    }
    setBookingSubmitting(true);
    try {
      await onBooked(
        worker,
        selectedDate.getDate(),
        selectedTime,
        selectedDateLabel,
        {
          ...bookingDetails,
          scheduledAt: new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            Number(selectedTime.split(":")[0] || 0),
            Number(selectedTime.split(":")[1] || 0)
          ).toISOString(),
        }
      );
    } catch (error) {
      setBookingSubmitError(
        getValidationMessage(error, "ჯავშნის შექმნა ვერ მოხერხდა")
      );
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="slide-in profile-page">
      <div className="profile-scroll">
        <button className="back-square" onClick={onBack}>
          ‹
        </button>

        <section className="profile-head">
          <div className="profile-avatar" style={{ color: worker.avatarColor }}>
            {worker.avatar.startsWith("data:image") ||
            worker.avatar.startsWith("http") ? (
              <img
                src={worker.avatar}
                alt={worker.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              worker.avatar
            )}
          </div>
          <div>
            <h1 className="screen-title">{worker.name}</h1>
            <p className="screen-subtitle">{workerProfessionText}</p>
          </div>
        </section>

        <div className="profile-stats">
          <div className="stat-card">
            <span>★</span>
            <strong>{worker.rating}</strong>
            <small>({worker.reviewCount}) შეფასება</small>
          </div>
          <div className="stat-card">
            <span>▣</span>
            <strong>{worker.exp}</strong>
            <small>წელი გამოცდილება</small>
          </div>
          <div className="stat-card">
            <span>₾</span>
            <strong>{worker.price}</strong>
            <small>საფასური</small>
          </div>
        </div>

        <section className="profile-section">
          <h2>შესახებ</h2>
          {worker.about.trim() && <p>{worker.about}</p>}
          <div className="profile-meta">⌖ {worker.city}</div>
        </section>

        {portfolio.length > 0 && <section className="profile-section">
          <h2>ნამუშევრები</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {portfolio.map((item) => <figure key={item.id} style={{ margin: 0 }}>
              <button type="button" onClick={() => setActivePortfolioItem(item)} style={{ width: "100%", padding: 0, background: "transparent", borderRadius: 12 }} aria-label="ნამუშევრის ფოტოს გადიდება">
                <img src={item.image_url} alt={item.profession_name || "შესრულებული სამუშაო"} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)", display: "block" }} />
              </button>
              {item.profession_name && <figcaption style={{ marginTop: 5, fontSize: 11, color: "var(--text2)", fontWeight: 800 }}>{item.profession_name}</figcaption>}
            </figure>)}
          </div>
        </section>}

        {activePortfolioItem && <div role="dialog" aria-modal="true" aria-label="ნამუშევრის ფოტო" onClick={() => setActivePortfolioItem(null)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 18, background: "rgba(15, 23, 42, .78)" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 680px)", maxHeight: "calc(100vh - 36px)", position: "relative" }}>
            <img src={activePortfolioItem.image_url} alt={activePortfolioItem.profession_name || "შესრულებული სამუშაო"} style={{ width: "100%", maxHeight: "calc(100vh - 90px)", objectFit: "contain", borderRadius: 12, background: "#111827", display: "block" }} />
            <button type="button" onClick={() => setActivePortfolioItem(null)} style={{ position: "absolute", top: 8, right: 8, width: 36, height: 36, borderRadius: 10, background: "rgba(15, 23, 42, .88)", color: "white", fontSize: 22, fontWeight: 900 }} aria-label="დახურვა">×</button>
          </div>
        </div>}

        <section className="profile-section">
          <h2>შეფასებები</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["ხარისხი", reviewAverages.quality],
              ["დროულობა", reviewAverages.punctuality],
              ["სისუფთავე", reviewAverages.cleanliness],
              ["ვადები", reviewAverages.deadline],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 950 }}>
                  ★ {Number(value).toFixed(1)}
                </div>
                <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 11, fontWeight: 850 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {workerReviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                style={{
                  padding: 11,
                  borderRadius: 12,
                  background: "white",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "var(--text)", fontSize: 12 }}>
                    ★ {review.overall.toFixed(1)}
                  </strong>
                  <span style={{ color: "var(--text3)", fontSize: 10, fontWeight: 800 }}>
                    {new Date(review.createdAt).toLocaleDateString("ka-GE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <div style={{ marginTop: 5, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                  ხარისხი {review.criteria.quality} · დროულობა {review.criteria.punctuality} ·
                  სისუფთავე {review.criteria.cleanliness} · ვადები {review.criteria.deadline}
                </div>
              </div>
            ))}
            {!workerReviews.length && (
              <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.45, fontWeight: 750 }}>
                დეტალური შეფასებები გამოჩნდება დასრულებული ჯავშნების შემდეგ.
              </div>
            )}
          </div>
        </section>

        <section className="profile-section">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>{monthLabel}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="month-button" onClick={() => shiftMonth(-1)}>
                ‹
              </button>
              <button className="month-button" onClick={() => shiftMonth(1)}>
                ›
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {dayNames.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: mondayOffset }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day
              );
              const isPast = date < today;
              const isBusy = isUnavailable(date);
              const isSelected = toDateKey(date) === toDateKey(selectedDate);
              return (
                <button
                  key={day}
                  className={[
                    "calendar-day",
                    isSelected ? "selected" : "",
                    isBusy ? "busy" : "",
                    isPast ? "past" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={isBusy || isPast}
                  onClick={() => chooseDate(date)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <section className="profile-section" ref={timesRef}>
          <h2>
            {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} თავისუფალი დრო
          </h2>
          {availableTimes.length > 0 ? (
            <div className="time-grid">
              {availableTimes.map((time) => (
                <button
                  key={time}
                  className={selectedTime === time ? "selected" : ""}
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </button>
              ))}
            </div>
          ) : (
            <p>ამ დღეს თავისუფალი დრო აღარ არის</p>
          )}
        </section>
      </div>

      <div className="booking-bar">
        <button className="chat-button" aria-label="message" onClick={onOpenMessages}>
          ●●●
        </button>
        <button
          className="booking-button"
          disabled={!selectedTime}
          onClick={() => {
            setBookingSubmitError("");
            setSitePhotoError("");
            setShowBookingConfirm(true);
          }}
        >
          {selectedTime ? `${selectedTime} დაჯავშნა` : "დრო აირჩიე"}
        </button>
      </div>

      {showBookingConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "88%",
              overflowY: "auto",
              padding: 22,
              borderRadius: "22px 22px 0 0",
              background: "white",
              boxShadow: "0 -18px 45px rgba(15,23,42,0.18)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 22, fontWeight: 900 }}>
              დეტალების დამატება
            </h2>
            <p style={{ margin: "0 0 12px", color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>
              {worker.name} · {selectedDateLabel} · {selectedTime}
            </p>
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 12,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "var(--text2)",
                fontSize: 12,
                lineHeight: 1.55,
                fontWeight: 750,
              }}
            >
              შევსება სავალდებულო არ არის, მაგრამ უკეთესი იქნება, თუ დეტალებს
              მიუთითებთ, რომ ხელოსანმა წინასწარ ზუსტად გაიგოს საქმე.
              დაჯავშნისას {platformSettings.bookingFee} ლარი დროებით
              გაყინულია და ხელოსანს არ ერიცხება, სანამ ვიზიტი არ დადასტურდება.
              გაუქმება უფასოა ვიზიტამდე {platformSettings.freeCancellationHours}
              საათით ადრე.
              <button
                type="button"
                onClick={() => setShowBookingRules((current) => !current)}
                style={{
                  display: "block",
                  marginTop: 9,
                  padding: 0,
                  background: "transparent",
                  color: "#1d4ed8",
                  border: 0,
                  fontSize: 12,
                  fontWeight: 950,
                  textDecoration: "underline",
                }}
              >
                {showBookingRules ? "წესების დახურვა" : "ჯავშნის წესების ნახვა"}
              </button>
            </div>
            {showBookingRules && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {[
                  ["ჯავშანი", legalSettings.bookingRules],
                  ["გაუქმება", legalSettings.cancellationRules],
                  ["კონტაქტი და კონფიდენციალურობა", legalSettings.privacyRules],
                  ["დავები და დახმარება", legalSettings.supportRules],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <strong style={{ display: "block", color: "var(--text)", fontSize: 12 }}>
                      {title}
                    </strong>
                    <span style={{ display: "block", marginTop: 4, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <label
              style={{
                display: "block",
                marginBottom: 14,
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              მისამართი ამ ჯავშნისთვის
              <span style={{ color: "#dc2626" }}> *</span>
              <input
                value={bookingDetails.visitAddress}
                onChange={(event) =>
                  setBookingDetails((prev) => ({
                    ...prev,
                    visitAddress: event.target.value,
                  }))
                }
                placeholder="მაგ: თბილისი, ვაკე, ჭავჭავაძის 12"
                style={{
                  width: "100%",
                  height: 42,
                  marginTop: 6,
                  padding: "0 10px",
                  borderRadius: 11,
                  border: "1px solid var(--border)",
                  background: "#f8fafc",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 750,
                }}
              />
            </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {[
                    { key: "area" as const, label: "სამუშაო ფართი მ²", placeholder: "მაგ: კედლები 45" },
                    { key: "height" as const, label: "სამუშაო სიმაღლე მ", placeholder: "მაგ: ჭერი 2.8" },
                    { key: "length" as const, label: "სამუშაო სიგრძე მ", placeholder: "მაგ: კედელი 12" },
                    { key: "rooms" as const, label: "ოთახების რაოდენობა", placeholder: "მაგ: 2" },
                  ].map((field) => (
                <label
                  key={field.key}
                  style={{
                    color: "var(--text2)",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {field.label}
                  <input
                    value={bookingDetails[field.key]}
                    onChange={(event) =>
                      setBookingDetails((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      height: 42,
                      marginTop: 6,
                      padding: "0 10px",
                      borderRadius: 11,
                      border: "1px solid var(--border)",
                      background: "#f8fafc",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 750,
                    }}
                  />
                </label>
                  ))}
                </div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 14,
                    color: "var(--text2)",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  დამატებითი ზომები ან რაოდენობა
                  <input
                    value={bookingDetails.extraMeasurements}
                    onChange={(event) =>
                      setBookingDetails((prev) => ({
                        ...prev,
                        extraMeasurements: event.target.value,
                      }))
                    }
                    placeholder="მაგ: კედელი 4x3, კარი 2 ცალი, მხოლოდ აბაზანა..."
                    style={{
                      width: "100%",
                      height: 42,
                      marginTop: 6,
                      padding: "0 10px",
                      borderRadius: 11,
                      border: "1px solid var(--border)",
                      background: "#f8fafc",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 750,
                    }}
                  />
                </label>
                {professionQuestions.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    {professionQuestions.map((field) => (
                      <label
                        key={field.key}
                        style={{
                          color: "var(--text2)",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {field.label}
                        <input
                          value={bookingDetails[field.key]}
                          onChange={(event) =>
                            setBookingDetails((prev) => ({
                              ...prev,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
                          style={{
                            width: "100%",
                            height: 42,
                            marginTop: 6,
                            padding: "0 10px",
                            borderRadius: 11,
                            border: "1px solid var(--border)",
                            background: "#f8fafc",
                            color: "var(--text)",
                            fontSize: 13,
                            fontWeight: 750,
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text2)",
                      fontSize: 11,
                      fontWeight: 900,
                      marginBottom: 8,
                    }}
                  >
                    ადგილის ფოტო
                  </div>
                  <div
                    style={{
                      color: "var(--text3)",
                      fontSize: 12,
                      lineHeight: 1.45,
                      marginBottom: 9,
                      fontWeight: 700,
                    }}
                  >
                    სურვილისამებრ დაამატე ფოტო, რომ ხელოსანმა ადგილზე არსებული
                    მდგომარეობა წინასწარ ნახოს.
                  </div>
                  {bookingDetails.sitePhoto ? (
                    <div>
                      <img
                        src={bookingDetails.sitePhoto}
                        alt="საქმის ფოტო"
                        style={{
                          width: "100%",
                          maxHeight: 180,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          display: "block",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSitePhotoError("");
                          setBookingDetails((prev) => ({ ...prev, sitePhoto: "" }));
                        }}
                        style={{
                          marginTop: 8,
                          minHeight: 36,
                          padding: "0 12px",
                          borderRadius: 10,
                          background: "#fef2f2",
                          color: "#b91c1c",
                          border: "1px solid #fecaca",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        ფოტოს წაშლა
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 88,
                        borderRadius: 12,
                        border: "1px dashed var(--border2)",
                        background: "white",
                        color: "var(--text2)",
                        fontSize: 13,
                        fontWeight: 850,
                        cursor: "pointer",
                      }}
                    >
                      ფოტოს დამატება
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleSitePhotoUpload(file);
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                  )}
                  {sitePhotoError && (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#b91c1c",
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.45,
                      }}
                    >
                      {sitePhotoError}
                    </div>
                  )}
                </div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 16,
                    color: "var(--text2)",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  კომენტარი ხელოსნისთვის
                  <textarea
                    value={bookingDetails.comment}
                    onChange={(event) =>
                      setBookingDetails((prev) => ({
                        ...prev,
                        comment: event.target.value,
                      }))
                    }
                    placeholder="რა გჭირდებათ, რა მდგომარეობაა ადგილზე..."
                    rows={3}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 11,
                      border: "1px solid var(--border)",
                      background: "#f8fafc",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 700,
                      resize: "vertical",
                    }}
                  />
                </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!bookingSubmitting) setShowBookingConfirm(false);
                }}
                disabled={bookingSubmitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: bookingSubmitting ? "#e2e8f0" : "#f1f5f9",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 900,
                  opacity: bookingSubmitting ? 0.75 : 1,
                }}
              >
                უკან
              </button>
              <button
                type="button"
                onClick={submitBooking}
                disabled={bookingSubmitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: bookingSubmitting ? "#64748b" : "var(--primary)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                {bookingSubmitting ? "იქმნება..." : "დაჯავშნა"}
              </button>
            </div>
            {bookingSubmitError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 11,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: 12,
                  fontWeight: 850,
                  lineHeight: 1.45,
                }}
              >
                {bookingSubmitError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
