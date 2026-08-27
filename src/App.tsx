import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookingStatus, Screen, Worker, User, UserRole } from "./types";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { BookingDetails, ProfileScreen } from "./screens/ProfileScreen";
import { ProfileUserScreen } from "./screens/ProfileUserScreen";
import { CraftsmanHomeScreen } from "./screens/CraftsmanHomeScreen";
import { BookingsScreen, Booking } from "./screens/BookingsScreen";
import { SuccessScreen } from "./screens/SuccessScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { BottomNav } from "./components/BottomNav";
import { dataService, isDemoDataMode } from "./services/dataService";
import type { ClientProfile, CraftsmanBookingRequest } from "./services/dataService";
import { isAbortError, reportApiError } from "./services/apiErrorUtils";
import {
  cancelBookingRequest,
  captureBookingPayment,
  changeBookingWorkerRequest,
  confirmBookingCompletion,
  createBookingRequest,
  refundBookingPayment,
  loadClientBookings,
  loadWorkerBookings,
  uploadBookingSitePhoto,
} from "./services/bookingApiService";
import { rememberClientReviewPoints } from "./services/clientPointsCache";
import { loadMessageThreads } from "./services/messageApiService";
import { openBookingDispute } from "./services/disputeApiService";
import {
  loadCurrentUserProfile,
  loadCurrentWorkerProfile,
} from "./services/profileApiService";
import {
  clearSupabaseSession,
  getSupabaseSession,
  refreshSupabaseSession,
  signOutSupabase,
} from "./services/supabaseAuthService";
import { getValidationMessage } from "./services/validation";
import {
  bookingStatusTransitionError,
  canChangeBookingStatus,
} from "./utils/bookingWorkflow";
import { usePlatformSettings } from "./hooks/usePlatformSettings";

const getClientProfile = (phone: string) => {
  if (!isDemoDataMode) return {};
  return dataService.getClientProfile(phone);
};

const getClientShortName = (phone: string, fallbackName?: string) => {
  const profile = getClientProfile(phone);
  const [fallbackFirst = "", fallbackLast = ""] = (fallbackName || "")
    .trim()
    .split(/\s+/);
  const firstName = (profile.firstName || fallbackFirst || "კლიენტი").trim();
  const lastName = (profile.lastName || fallbackLast).trim();
  return lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
};

const getUnreadMessageCount = (
  role: "client" | "craftsman",
  bookingIds?: string[]
) => {
  try {
    const messages = dataService.getBookingMessages();
    const reads = dataService.getMessageReads(role);
    const allowed = bookingIds ? new Set(bookingIds) : null;
    const latestByBooking = new Map<string, (typeof messages)[number]>();
    messages.forEach((message) => {
      if (allowed && !allowed.has(message.bookingId)) return;
      if (message.sender === role) return;
      const current = latestByBooking.get(message.bookingId);
      if (!current || current.createdAt < message.createdAt) {
        latestByBooking.set(message.bookingId, message);
      }
    });
    return Array.from(latestByBooking.values()).reduce((sum, latest) => {
      const lastReadAt = reads[latest.bookingId] || "";
      return (
        sum +
        messages.filter(
          (message) =>
            message.bookingId === latest.bookingId &&
            message.sender !== role &&
            (!lastReadAt || message.createdAt > lastReadAt)
        ).length
      );
    }, 0);
  } catch {
    return 0;
  }
};

const archivedBookingStatuses = new Set<BookingStatus>([
  "client_confirmed",
  "closed",
  "completed",
  "declined",
  "cancelled",
  "disputed",
]);

const isActiveBookingStatus = (status?: BookingStatus) =>
  !archivedBookingStatuses.has(status || "pending");

// Supabase returns fresh array instances on every poll. Keep the current state
// when its content has not changed so background sync does not restart screens.
const keepEqualSnapshot = <T,>(current: T[], next: T[]) =>
  JSON.stringify(current) === JSON.stringify(next) ? current : next;

const screenPathMap: Partial<Record<Screen, string>> = {
  home: "/",
  search: "/search",
  bookings: "/bookings",
  messages: "/messages",
  "user-profile": "/profile",
};

const screenFromPath = (path: string): Screen | null => {
  const normalized = path.replace(/\/+$/, "") || "/";
  const match = Object.entries(screenPathMap).find(([, route]) => route === normalized);
  return (match?.[0] as Screen | undefined) || null;
};

type AccountStatus = NonNullable<ClientProfile["accountStatus"]>;

const AccountStatusBanner: React.FC<{ status: AccountStatus }> = ({ status }) => {
  if (status === "active") return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(8px + var(--safe-top))",
        left: 16,
        right: 16,
        zIndex: 80,
        padding: "10px 12px",
        borderRadius: 14,
        background: status === "blocked" ? "#fef2f2" : "#fff7ed",
        color: status === "blocked" ? "#b91c1c" : "#c2410c",
        border: `1px solid ${status === "blocked" ? "#fecaca" : "#fed7aa"}`,
        fontSize: 12,
        fontWeight: 900,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {status === "blocked"
        ? "ანგარიში დაბლოკილია. მოქმედებები შეჩერებულია."
        : "ანგარიში შეზღუდულია. ახალი კრიტიკული მოქმედებები დროებით შეჩერებულია."}
    </div>
  );
};

const BlockedAccountScreen: React.FC<{
  role: UserRole;
  onLogout: () => void;
}> = ({ role, onLogout }) => (
  <div
    style={{
      height: "100%",
      padding: "calc(70px + var(--safe-top)) 24px 28px",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        border: "1px solid #fecaca",
        borderRadius: 18,
        background: "white",
        padding: 22,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ color: "#b91c1c", fontSize: 28, fontWeight: 950 }}>
        ანგარიში დაბლოკილია
      </div>
      <div style={{ marginTop: 10, color: "var(--text2)", fontSize: 13, lineHeight: 1.55 }}>
        {role === "craftsman"
          ? "ხელოსნის ანგარიშზე მოქმედებები შეჩერებულია Admin-ის გადაწყვეტილებით."
          : "კლიენტის ანგარიშზე მოქმედებები შეჩერებულია Admin-ის გადაწყვეტილებით."}
      </div>
      <button
        type="button"
        onClick={onLogout}
        style={{
          width: "100%",
          minHeight: 46,
          marginTop: 18,
          borderRadius: 12,
          background: "var(--primary)",
          color: "white",
          fontSize: 14,
          fontWeight: 950,
        }}
      >
        გასვლა
      </button>
    </div>
  </div>
);

const VerificationRequiredScreen: React.FC<{
  onOpenProfile: () => void;
  onLogout: () => void;
}> = ({ onOpenProfile, onLogout }) => (
  <div
    style={{
      height: "100%",
      padding: "calc(70px + var(--safe-top)) 24px 110px",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        border: "1px solid #fde68a",
        borderRadius: 18,
        background: "white",
        padding: 22,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ color: "var(--text)", fontSize: 24, fontWeight: 950 }}>
        ვერიფიკაცია საჭიროა
      </div>
      <div style={{ marginTop: 10, color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>
        სამუშაო ადგილი გაიხსნება მხოლოდ მას შემდეგ, რაც Admin პირადობასა და
        ანგარიშის დოკუმენტს გადაამოწმებს და დაგიდასტურებს.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <button
          type="button"
          onClick={onOpenProfile}
          style={{
            minHeight: 46,
            borderRadius: 12,
            background: "var(--primary)",
            color: "white",
            fontSize: 13,
            fontWeight: 950,
          }}
        >
          პროფილი
        </button>
        <button
          type="button"
          onClick={onLogout}
          style={{
            minHeight: 46,
            borderRadius: 12,
            background: "#f1f5f9",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 950,
          }}
        >
          გასვლა
        </button>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const { platformSettings } = usePlatformSettings();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [messageTargetBookingId, setMessageTargetBookingId] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    return isDemoDataMode ? dataService.getClientBookings() : [];
  });
  const [clientBookingsHydrated, setClientBookingsHydrated] = useState(
    isDemoDataMode
  );
  const [craftsmanBookings, setCraftsmanBookings] = useState<
    CraftsmanBookingRequest[]
  >([]);
  const [successData, setSuccessData] = useState<{
    worker: Worker;
    day: number;
    time: string;
    dateLabel: string;
  } | null>(null);
  const [prevScreen, setPrevScreen] = useState<Screen>("home");
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [apiUnreadMessages, setApiUnreadMessages] = useState(0);
  const [demoUnreadVersion, setDemoUnreadVersion] = useState(0);
  const [bookingActionError, setBookingActionError] = useState("");
  const [apiWorkerVerificationStatus, setApiWorkerVerificationStatus] =
    useState<string | null>(null);
  const [apiAccountStatus, setApiAccountStatus] =
    useState<AccountStatus>("active");
  const [restoringSession, setRestoringSession] = useState(
    () => !isDemoDataMode && Boolean(getSupabaseSession()?.access_token)
  );
  const pendingRouteScreenRef = React.useRef<Screen | null>(null);

  const setBrowserPath = (path: string, replace = false) => {
    if (window.location.pathname === path) return;
    if (replace) {
      window.history.replaceState(window.history.state, "", path);
      return;
    }
    window.history.pushState(window.history.state, "", path);
  };

  const loadApiUserIntoApp = async (
    fallbackPhone = "",
    fallbackRole: UserRole = "client"
  ): Promise<UserRole> => {
    const profile = await loadCurrentUserProfile();
    const nextRole = profile?.role || fallbackRole;
    const profileName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const nextUser: User = {
      phone: profile?.phone || fallbackPhone,
      role: nextRole,
      name:
        profileName ||
        (nextRole === "admin" ? "ადმინისტრატორი" : undefined),
    };
    const status = profile?.status;

    setUser(nextUser);
    setApiAccountStatus(
      status === "blocked" || status === "limited" || status === "active"
        ? status
        : "active"
    );
    setApiWorkerVerificationStatus(null);

    if (nextRole === "client") {
      setClientBookingsHydrated(false);
      loadClientBookings()
        .then((nextBookings) => {
          setBookings(nextBookings);
          setClientBookingsHydrated(true);
        })
        .catch((error) => {
          reportApiError(error, { silentTransient: true });
          setBookings([]);
          setClientBookingsHydrated(true);
        });
    } else if (nextRole === "craftsman") {
      loadWorkerBookings()
        .then(setCraftsmanBookings)
        .catch((error) => {
          reportApiError(error, { silentTransient: true });
          setCraftsmanBookings([]);
        });
      setBookings([]);
      setClientBookingsHydrated(false);
    } else {
      setBookings([]);
      setCraftsmanBookings([]);
      setClientBookingsHydrated(false);
    }

    if (nextRole === "craftsman") {
      loadCurrentWorkerProfile()
        .then((workerProfile) => {
          setApiWorkerVerificationStatus(
            workerProfile?.verification_status === "not_started"
              ? "not_submitted"
              : workerProfile?.verification_status || "not_submitted"
          );
        })
        .catch((error) => {
          reportApiError(error, { silentTransient: true });
          setApiWorkerVerificationStatus("not_submitted");
        });
    }

    return nextRole;
  };

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;

    const restoreSession = async () => {
      const session = getSupabaseSession();
      if (!session?.access_token) {
        setRestoringSession(false);
        return;
      }

      try {
        if (session.refresh_token) {
          await refreshSupabaseSession().catch((error) => {
            reportApiError(error, { silentTransient: true });
            return null;
          });
        }
        if (!cancelled) {
          await loadApiUserIntoApp(
            session.user?.phone || session.user?.email || "",
            "client"
          );
        }
      } catch (error) {
        reportApiError(error, { silentTransient: true });
        clearSupabaseSession();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoringSession) return;
    if (!user) {
      if (location.pathname !== "/login" && location.pathname !== "/admin") {
        setBrowserPath("/login", true);
      }
      return;
    }
    if (user.role === "admin") {
      if (location.pathname !== "/admin") {
        setBrowserPath("/admin", true);
      }
      return;
    }

    const routeScreen = screenFromPath(location.pathname);
    if (routeScreen) {
      const pendingScreen = pendingRouteScreenRef.current;
      if (pendingScreen && pendingScreen !== routeScreen) {
        return;
      }
      pendingRouteScreenRef.current = null;
      setScreen((currentScreen) => {
        if (currentScreen === "profile" || currentScreen === "booking-confirm") {
          return currentScreen;
        }
        return currentScreen === routeScreen ? currentScreen : routeScreen;
      });
    }
  }, [location.pathname, restoringSession, user]);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    const routeScreen = screenFromPath(location.pathname);
    if (routeScreen) return;
    const fallbackPath = screenPathMap[screen] || "/";
    if (location.pathname !== fallbackPath) {
      setBrowserPath(fallbackPath, true);
    }
  }, [location.pathname, screen, user]);

  useEffect(() => {
    if (isDemoDataMode || !user) return;

    let cancelled = false;
    let activeController: AbortController | null = null;
    const refreshApiBookings = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        if (user.role === "client") {
          const nextBookings = await loadClientBookings(controller.signal);
          if (!cancelled) {
            setBookings((current) => keepEqualSnapshot(current, nextBookings));
            setClientBookingsHydrated(true);
          }
          return;
        }
        if (user.role === "craftsman") {
          const nextBookings = await loadWorkerBookings(controller.signal);
          if (!cancelled) {
            setCraftsmanBookings((current) =>
              keepEqualSnapshot(current, nextBookings)
            );
          }
        }
      } catch (error) {
        if (!cancelled && user.role === "client") {
          setClientBookingsHydrated(true);
        }
        reportApiError(error, { silentTransient: true });
      }
    };

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") refreshApiBookings();
    };

    refreshApiBookings();
    window.addEventListener("booking-status-updated", refreshApiBookings);
    window.addEventListener("focus", refreshApiBookings);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.removeEventListener("booking-status-updated", refreshApiBookings);
      window.removeEventListener("focus", refreshApiBookings);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [user?.phone, user?.role]);

  useEffect(() => {
    if (!isDemoDataMode || !user) return;

    const refreshDemoState = () => {
      if (user.role === "client") {
        setBookings((current) =>
          keepEqualSnapshot(current, dataService.getClientBookings())
        );
        return;
      }
      if (user.role === "craftsman") {
        setCraftsmanBookings((current) =>
          keepEqualSnapshot(current, dataService.getRealCraftsmanRequests())
        );
      }
    };

    window.addEventListener("client-bookings-updated", refreshDemoState);
    window.addEventListener("craftsman-bookings-updated", refreshDemoState);
    window.addEventListener("booking-status-updated", refreshDemoState);

    return () => {
      window.removeEventListener("client-bookings-updated", refreshDemoState);
      window.removeEventListener("craftsman-bookings-updated", refreshDemoState);
      window.removeEventListener("booking-status-updated", refreshDemoState);
    };
  }, [user?.phone, user?.role]);

  const handleLogin = async (phone: string, role: UserRole) => {
    if (!isDemoDataMode) {
      try {
        const nextRole = await loadApiUserIntoApp(phone, role);
        if (role === "admin" && nextRole !== "admin") {
          clearSupabaseSession();
          setUser(null);
          throw new Error("ამ ანგარიშს Admin პანელზე წვდომა არ აქვს.");
        }
        setBrowserPath(nextRole === "admin" ? "/admin" : "/", true);
        setScreen("home");
      } catch (error) {
        reportApiError(error, { silentTransient: true });
        if (role === "admin") {
          clearSupabaseSession();
          setUser(null);
          setBrowserPath("/admin", true);
          throw error;
        }
        setUser({
          phone,
          role,
        });
        setApiAccountStatus("active");
        setBrowserPath("/", true);
        setScreen("home");
      }
      return;
    }

    if (role === "admin") {
      setUser({ phone, role, name: "ადმინისტრატორი" });
      setBrowserPath("/admin", true);
      setScreen("home");
      return;
    }
    const profile = role === "client" ? getClientProfile(phone) : {};
    const profileName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    setUser({ phone, role, name: profileName || undefined });
    setApiAccountStatus("active");
    if (role === "client" && isDemoDataMode) {
      setBookings(dataService.getClientBookings());
    }
    setBrowserPath("/", true);
    setScreen("home");
  };

  const handleLogout = () => {
    if (!isDemoDataMode) {
      signOutSupabase().catch((error) => {
        reportApiError(error, { silentTransient: true });
      });
    }
    setUser(null);
    setBrowserPath("/login", true);
    setScreen("home");
    setBookings([]);
    setApiWorkerVerificationStatus(null);
    setApiAccountStatus("active");
  };

  const handleProfileUpdated = (profile: {
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
  }) => {
    const nextName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    setUser((current) =>
      current
        ? {
            ...current,
            name: nextName || current.name,
          }
        : current
    );
  };

  const getCurrentAccountStatus = (): AccountStatus => {
    if (!user || user.role === "admin") return "active";
    if (!isDemoDataMode) return apiAccountStatus;
    if (user.role === "client") {
      return dataService.getClientProfile(user.phone).accountStatus || "active";
    }
    return dataService.getCraftsmanProfile().accountStatus || "active";
  };

  useEffect(() => {
    if (user?.role === "client" && isDemoDataMode) {
      dataService.saveClientBookings(bookings);
    }
  }, [bookings, user?.role]);

  useEffect(() => {
    if (isDemoDataMode || user?.role !== "client") return;
    if (screen !== "bookings" && screen !== "messages") return;

    let cancelled = false;
    const controller = new AbortController();
    loadClientBookings(controller.signal)
      .then((nextBookings) => {
        if (!cancelled) {
          setBookings((current) => keepEqualSnapshot(current, nextBookings));
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [screen, user?.role]);

  useEffect(() => {
    if (isDemoDataMode || user?.role !== "craftsman") return;
    // The craftsman workspace owns its booking refresh for home and bookings.
    // App only needs an immediate refresh when the separate messages screen opens.
    if (screen !== "messages") return;

    let cancelled = false;
    const controller = new AbortController();
    loadWorkerBookings(controller.signal)
      .then((nextBookings) => {
        if (!cancelled) {
          setCraftsmanBookings((current) =>
            keepEqualSnapshot(current, nextBookings)
          );
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [screen, user?.role]);

  useEffect(() => {
    if (isDemoDataMode || !user) return;

    let cancelled = false;
    const controller = new AbortController();
    loadCurrentUserProfile(controller.signal)
      .then((profile) => {
        if (cancelled) return;
        const status = profile?.status;
        if (status === "blocked" || status === "limited" || status === "active") {
          setApiAccountStatus(status);
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.phone, user?.role]);

  useEffect(() => {
    if (isDemoDataMode || !user) return;
    if (screen === "messages") return;

    let cancelled = false;
    const controller = new AbortController();
    loadMessageThreads(controller.signal)
      .then((threads) => {
        if (!cancelled) {
          setApiUnreadMessages(
            threads.reduce((sum, thread) => sum + thread.unreadCount, 0)
          );
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [screen, user]);

  useEffect(() => {
    if (isDemoDataMode || user?.role !== "craftsman") return;

    let cancelled = false;
    const controller = new AbortController();
    loadCurrentWorkerProfile(controller.signal)
      .then((profile) => {
        if (!cancelled) {
          setApiWorkerVerificationStatus(
            profile?.verification_status === "not_started"
              ? "not_submitted"
              : profile?.verification_status || "not_submitted"
          );
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
        if (!cancelled) setApiWorkerVerificationStatus("not_submitted");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.phone, user?.role]);

  const showScreen = (nextScreen: Screen, replace = false) => {
    const nextPath = screenPathMap[nextScreen];
    if (nextPath && location.pathname !== nextPath) {
      pendingRouteScreenRef.current = nextScreen;
      setBrowserPath(nextPath, replace);
    } else {
      pendingRouteScreenRef.current = null;
    }
    setScreen(nextScreen);
  };

  const goToWorker = (w: Worker) => {
    if (w.verificationStatus && w.verificationStatus !== "verified") {
      window.alert("ეს ხელოსანი ჯერ ვერიფიცირებული არ არის და დაჯავშნა დროებით შეუძლებელია.");
      return;
    }
    setPrevScreen(screen);
    setSelectedWorker(w);
    showScreen("profile");
  };

  const goToCategory = (cat: string) => {
    setSearchCategory(cat);
    showScreen("search");
  };

  const handleBooked = async (
    worker: Worker,
    day: number,
    time: string,
    dateLabel: string,
    details: BookingDetails
  ) => {
    const accountStatus = getCurrentAccountStatus();
    if (accountStatus !== "active") {
      throw new Error("ანგარიში შეზღუდულია. ახალი ჯავშნის გაკეთება დროებით შეუძლებელია.");
    }
    if (worker.verificationStatus && worker.verificationStatus !== "verified") {
      throw new Error("ეს ხელოსანი ჯერ ვერიფიცირებული არ არის და დაჯავშნა დროებით შეუძლებელია.");
    }
    const workerKey = worker.backendId || String(worker.id);
    const activeDuplicate = bookings.some((booking) => {
      const bookingWorkerKey = booking.worker.backendId || String(booking.worker.id);
      return (
        bookingWorkerKey === workerKey &&
        !["cancelled", "declined", "client_confirmed", "closed", "completed"].includes(
          booking.status || "pending"
        )
      );
    });
    if (activeDuplicate) {
      throw new Error("ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი. ჯერ დაასრულეთ ან გააუქმეთ არსებული ჯავშანი.");
    }
    const requestedSlot = details.scheduledAt
      ? `${details.scheduledAt.slice(0, 10)}T${time}`
      : "";
    if (requestedSlot && worker.bookedSlots?.includes(requestedSlot)) {
      throw new Error("ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა დრო.");
    }
    const clientProfile = getClientProfile(user?.phone || "");
    const apiClientProfile =
      !isDemoDataMode && user?.role === "client"
        ? await loadCurrentUserProfile().catch((error) => {
            reportApiError(error, { silentTransient: true });
            return null;
          })
        : null;
    const addressOverride = details.visitAddress.trim();
    if (!addressOverride) {
      throw new Error("მისამართი სავალდებულოა. მიუთითე სად უნდა მოვიდეს ხელოსანი.");
    }
    const profileCity = apiClientProfile?.city || clientProfile.city || worker.city;
    const profileAddress =
      apiClientProfile?.address_text || clientProfile.address || "";
    const requestAddress = [
      profileCity,
      addressOverride,
    ]
      .filter(Boolean)
      .join(", ");
    if (!isDemoDataMode) {
      try {
        setBookingActionError("");
        const uploadedSitePhoto = details.sitePhoto
          ? await uploadBookingSitePhoto(
              details.sitePhoto,
              worker.backendId || worker.id
            )
          : "";
        await createBookingRequest({
          worker,
          scheduledAt:
            details.scheduledAt ||
            new Date(`${dateLabel} ${time}`).toISOString(),
          city: profileCity,
          addressText: requestAddress,
          details: {
            ...details,
            sitePhoto: uploadedSitePhoto,
          },
        });
        const nextBookings = await loadClientBookings();
        setBookings(nextBookings);
        setSuccessData({ worker, day, time, dateLabel });
        setScreen("booking-confirm");
      } catch (error) {
        reportApiError(error, { silentTransient: true });
        const message = getValidationMessage(error, "ჯავშნის შექმნა ვერ მოხერხდა");
        setBookingActionError(message);
        throw new Error(message);
      }
      return;
    }
    const booking: Booking = {
      worker,
      day,
      time,
      dateLabel,
      details,
      status: "pending" as const,
      bookingFee: platformSettings.bookingFee,
      paymentStatus: "held",
      paymentProvider: platformSettings.paymentProvider,
      paymentCurrency: platformSettings.paymentCurrency,
      paymentTransactionId: `demo-${Date.now()}`,
      id: `${worker.id}-${day}-${time}-${Date.now()}`,
    };
    setBookings((prev) => [...prev, booking]);
    const request: CraftsmanBookingRequest = {
      id: booking.id,
      clientName: getClientShortName(user?.phone || "", user?.name),
      clientPhone: user?.phone || "",
      date: dateLabel,
      time,
      address: requestAddress,
      status: "pending",
      service: worker.role,
      comment: details.comment,
      measurements: {
        area: details.area,
        height: details.height,
        length: details.length,
        rooms: details.rooms,
        extraMeasurements: details.extraMeasurements,
        wallCondition: details.wallCondition,
        targetSurface: details.targetSurface,
        materialOwner: details.materialOwner,
        plumbingType: details.plumbingType,
        floor: details.floor,
        electricPoints: details.electricPoints,
        electricPanel: details.electricPanel,
        isEmergency: details.isEmergency,
        workScope: details.workScope,
        surfaceType: details.surfaceType,
        materialNote: details.materialNote,
        itemCount: details.itemCount,
        currentCondition: details.currentCondition,
        photoNote: details.photoNote,
        sitePhoto: details.sitePhoto,
        roofType: details.roofType,
      },
    };
    dataService.prependCraftsmanRequest(request);
    dataService.prependCraftsmanNotification({
      id: `${booking.id}-new-booking-${Date.now()}`,
      bookingId: booking.id,
      type: "confirmed",
      title: "ახალი ჯავშანი",
      text: `${request.clientName} · ${worker.role} · ${dateLabel} · ${time}`,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    setSuccessData({ worker, day, time, dateLabel });
    setScreen("booking-confirm");
  };

  const handleSuccessDone = () => {
    setSuccessData(null);
    showScreen("bookings");
  };

  const handleCancelBooking = async (id: string, reason: string) => {
    const cancellationReason = reason || "კლიენტმა გააუქმა";
    const targetBooking = bookings.find((booking) => booking.id === id);
    if (!targetBooking || !canChangeBookingStatus("client", targetBooking.status, "cancelled")) {
      throw new Error(bookingStatusTransitionError("client"));
    }
    const scheduledAt = targetBooking?.details.scheduledAt
      ? new Date(targetBooking.details.scheduledAt).getTime()
      : 0;
    const hoursUntilVisit = scheduledAt
      ? (scheduledAt - Date.now()) / 36e5
      : Number.POSITIVE_INFINITY;
    const isLateCancellation =
      hoursUntilVisit < platformSettings.freeCancellationHours;
    const bookingFee = targetBooking?.bookingFee || platformSettings.bookingFee;
    const penaltyAmount = isLateCancellation
      ? Math.round((bookingFee * platformSettings.lateCancellationFeePercent) / 100)
      : 0;
    const finalReason = isLateCancellation
      ? `${cancellationReason} · დაგვიანებული გაუქმება, გადასამოწმებელია`
      : cancellationReason;
    if (!isDemoDataMode) {
      setBookingActionError("");
      try {
        await cancelBookingRequest(id, finalReason);
        try {
          if (!isLateCancellation) {
            await refundBookingPayment(id, finalReason);
          } else {
            await openBookingDispute(
              id,
              "დაგვიანებული გაუქმება",
              `სავარაუდო თანხის დაკავება: ${penaltyAmount} ლარი. მიზეზი: ${cancellationReason}`
            );
          }
        } catch (followUpError) {
          const followUpMessage = getValidationMessage(followUpError, "");
          setBookingActionError(
            followUpMessage
              ? `ჯავშანი გაუქმდა, მაგრამ თანხის/დავის ჩანაწერის განახლება ვერ მოხერხდა: ${followUpMessage}`
              : "ჯავშანი გაუქმდა, მაგრამ თანხის/დავის ჩანაწერის განახლება ვერ მოხერხდა"
          );
        }
        setBookings(await loadClientBookings());
      } catch (error) {
        const message = getValidationMessage(error, "ჯავშნის გაუქმება ვერ მოხერხდა");
        setBookingActionError(message);
        throw new Error(message);
      }
      return;
    }
    setBookings((prev) => {
      const next = prev.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              status: "cancelled" as const,
              paymentStatus: isLateCancellation
                ? ("disputed" as const)
                : ("refunded" as const),
              cancellationReason: finalReason,
              cancellationPolicy: isLateCancellation
                ? ("late_review" as const)
                : ("free" as const),
              cancellationPenaltyAmount: penaltyAmount,
            }
          : booking
      );
      if (isDemoDataMode) {
        dataService.saveClientBookings(next);
        dataService.updateCraftsmanRequestStatus(id, "cancelled");
        dataService.updateCraftsmanRequest(id, (request) => ({
          ...request,
          cancellationReason: finalReason,
          disputeReason: isLateCancellation
            ? "დაგვიანებული გაუქმება"
            : request.disputeReason,
          disputeDetails: isLateCancellation
            ? `სავარაუდო თანხის დაკავება: ${penaltyAmount} ლარი`
            : request.disputeDetails,
        }));
        dataService.prependCraftsmanNotification({
          id: `${id}-cancel-${Date.now()}`,
          bookingId: id,
          type: "confirmed",
          title: isLateCancellation
            ? "ჯავშანი გაუქმდა და განხილვაში გადავიდა"
            : "ჯავშანი გაუქმდა",
          text: isLateCancellation
            ? `კლიენტმა გააუქმა უფასო პერიოდის შემდეგ. სავარაუდო თანხის დაკავება: ${penaltyAmount} ლარი.`
            : `კლიენტმა გააუქმა ჯავშანი. მიზეზი: ${cancellationReason}`,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        if (isLateCancellation) {
          dataService.prependBookingDispute({
            id: `${id}-late-cancel-${Date.now()}`,
            bookingId: id,
            reason: "დაგვიანებული გაუქმება",
            details: `კლიენტმა გააუქმა უფასო პერიოდის შემდეგ. სავარაუდო თანხის დაკავება: ${penaltyAmount} ლარი.`,
            createdAt: new Date().toISOString(),
            status: "open",
          });
        }
      }
      return next;
    });
  };

  const handleChangeBookingWorker = async (id: string, worker: Worker) => {
    const targetBooking = bookings.find((booking) => booking.id === id);
    if (!targetBooking) {
      throw new Error("ჯავშანი ვერ მოიძებნა");
    }
    if (targetBooking.status !== "pending" && targetBooking.status !== "declined") {
      throw new Error(
        "ხელოსნის შეცვლა შესაძლებელია მხოლოდ მოლოდინში ან უარყოფილ ჯავშანზე"
      );
    }
    if (targetBooking.worker.id === worker.id) {
      throw new Error("აირჩიეთ სხვა ხელოსანი");
    }

    if (!isDemoDataMode) {
      setBookingActionError("");
      try {
        await changeBookingWorkerRequest(
          id,
          worker,
          "კლიენტმა სხვა ხელოსანი აირჩია"
        );
        setBookings(await loadClientBookings());
        window.dispatchEvent(
          new CustomEvent("booking-status-updated", {
            detail: { bookingId: id, status: "cancelled", target: "client" },
          })
        );
        return;
      } catch (error) {
        const message = getValidationMessage(error, "ხელოსნის შეცვლა ვერ მოხერხდა");
        setBookingActionError(message);
        throw new Error(message);
      }
    }

    const newBookingId = `${worker.id}-${targetBooking.day}-${targetBooking.time}-${Date.now()}`;
    const nextBooking: Booking = {
      ...targetBooking,
      id: newBookingId,
      worker,
      status: "pending",
      paymentStatus: "held",
      cancellationReason: undefined,
      cancellationPolicy: undefined,
      cancellationPenaltyAmount: undefined,
      disputeReason: undefined,
      disputeDetails: undefined,
      disputeStatus: undefined,
      disputeResolution: undefined,
      disputeEvidence: undefined,
    };

    setBookings((current) => {
      const next = [
        nextBooking,
        ...current.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                status:
                  booking.status === "pending"
                    ? ("cancelled" as const)
                    : booking.status,
                paymentStatus: "refunded" as const,
                cancellationReason: "კლიენტმა სხვა ხელოსანი აირჩია",
                cancellationPolicy: "free" as const,
              }
            : booking
        ),
      ];
      dataService.saveClientBookings(next);
      return next;
    });

    const oldRequest = dataService
      .getCraftsmanRequests()
      .find((request) => request.id === id);
    dataService.updateCraftsmanRequest(id, (request) => ({
      ...request,
      status: request.status === "pending" ? "cancelled" : request.status,
      cancellationReason: "კლიენტმა სხვა ხელოსანი აირჩია",
    }));
    dataService.prependCraftsmanRequest({
      ...(oldRequest || {
        clientName: getClientShortName(user?.phone || "", user?.name),
        clientPhone: user?.phone || "",
        date: targetBooking.dateLabel,
        time: targetBooking.time,
        address: targetBooking.details.visitAddress || "მისამართი დასაზუსტებელია",
        service: worker.role,
        comment: targetBooking.details.comment,
        measurements: {
          area: targetBooking.details.area,
          height: targetBooking.details.height,
          length: targetBooking.details.length,
          rooms: targetBooking.details.rooms,
          extraMeasurements: targetBooking.details.extraMeasurements,
          wallCondition: targetBooking.details.wallCondition,
          targetSurface: targetBooking.details.targetSurface,
          materialOwner: targetBooking.details.materialOwner,
          plumbingType: targetBooking.details.plumbingType,
          floor: targetBooking.details.floor,
          electricPoints: targetBooking.details.electricPoints,
          electricPanel: targetBooking.details.electricPanel,
          isEmergency: targetBooking.details.isEmergency,
          workScope: targetBooking.details.workScope,
          surfaceType: targetBooking.details.surfaceType,
          materialNote: targetBooking.details.materialNote,
          itemCount: targetBooking.details.itemCount,
          currentCondition: targetBooking.details.currentCondition,
          photoNote: targetBooking.details.photoNote,
          sitePhoto: targetBooking.details.sitePhoto,
          roofType: targetBooking.details.roofType,
        },
      }),
      id: newBookingId,
      status: "pending",
      service: worker.role,
      cancellationReason: undefined,
    });
    dataService.prependCraftsmanNotification({
      id: `${newBookingId}-replacement-${Date.now()}`,
      bookingId: newBookingId,
      type: "confirmed",
      title: "ახალი ჯავშანი",
      text: `${nextBooking.dateLabel} · ${nextBooking.time} · ${worker.role}`,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    dataService.prependClientNotification({
      id: `${newBookingId}-replacement-client-${Date.now()}`,
      bookingId: newBookingId,
      type: "confirmed",
      text: "ახალი მოთხოვნა არჩეულ ხელოსანს გაეგზავნა და პასუხს ელოდება.",
    });
  };

  const handleReviewBooking = async (id: string) => {
    const targetBooking = bookings.find((booking) => booking.id === id);
    if (targetBooking?.status === "declined") {
      return;
    }
    if (!targetBooking || !canChangeBookingStatus("client", targetBooking.status, "client_confirmed")) {
      throw new Error(bookingStatusTransitionError("client"));
    }
    if (!isDemoDataMode) {
      setBookingActionError("");
      await confirmBookingCompletion(id);
      try {
        await captureBookingPayment(id);
      } catch (error) {
        const captureMessage = getValidationMessage(error, "");
        setBookingActionError(
          captureMessage
            ? `სამუშაო დადასტურდა, მაგრამ თანხის დადასტურება ვერ მოხერხდა: ${captureMessage}`
            : "სამუშაო დადასტურდა, მაგრამ თანხის დადასტურება ვერ მოხერხდა"
        );
      }
      if (user?.phone) {
        rememberClientReviewPoints(user.phone, id);
      }
      setBookings(await loadClientBookings());
      return;
    }
    setBookings((prev) => {
      const next = prev.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              worker: isDemoDataMode
                ? {
                    ...booking.worker,
                    rating:
                      dataService.getWorkerRating(booking.worker.id)?.value ??
                      booking.worker.rating,
                    reviewCount:
                      dataService.getWorkerRating(booking.worker.id)?.count ??
                      booking.worker.reviewCount,
                  }
                : booking.worker,
              status: "closed" as const,
              paymentStatus: "released" as const,
            }
          : booking
      );
      if (isDemoDataMode) {
        if (user?.phone) {
          dataService.addClientPoints(
            user.phone,
            10,
            "ხელოსნის შეფასება დასრულებული ჯავშნის შემდეგ"
          );
        }
        dataService.saveClientBookings(next);
        dataService.updateCraftsmanRequestStatus(id, "closed");
      }
      return next;
    });
  };

  const handleProblemOpened = async (
    id: string,
    reason: string,
    details: string,
    evidence?: Booking["disputeEvidence"]
  ) => {
    if (!isDemoDataMode) {
      setBookingActionError("");
      try {
        setBookings(await loadClientBookings());
      } catch (error) {
        const message = getValidationMessage(error, "ჯავშნების განახლება ვერ მოხერხდა");
        setBookingActionError(message);
        throw new Error(message);
      }
      return;
    }
    setBookings((prev) => {
      const next = prev.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              status: "disputed" as const,
              paymentStatus: "disputed" as const,
              disputeReason: reason,
              disputeDetails: details,
              disputeStatus: "open" as const,
              disputeEvidence: evidence,
            }
          : booking
      );
      if (isDemoDataMode) {
        dataService.saveClientBookings(next);
        dataService.updateCraftsmanRequest(id, (request) => ({
          ...request,
          status: "disputed",
          disputeReason: reason,
          disputeDetails: details,
          disputeStatus: "open",
          disputeEvidence: evidence,
        }));
        dataService.prependCraftsmanNotification({
          id: `${id}-dispute-${Date.now()}`,
          bookingId: id,
          type: "confirmed",
          title: "კლიენტმა პრობლემა გახსნა",
          text: `მიზეზი: ${reason}. Admin გადაამოწმებს საკითხს.`,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      return next;
    });
  };

  const navigate = (s: Screen) => {
    setBookingActionError("");
    if (s !== "booking-confirm") {
      setSuccessData(null);
    }
    setSelectedWorker(null);
    if (s !== "messages") setMessageTargetBookingId(null);
    showScreen(s);
  };

  const handleUnreadChange = (count: number) => {
    if (isDemoDataMode) {
      setDemoUnreadVersion((version) => version + 1);
      return;
    }
    setApiUnreadMessages(count);
  };

  const showNav = screen !== "profile" && screen !== "booking-confirm";
  const unreadMessages = useMemo(() => {
    if (!user) return 0;
    if (!isDemoDataMode) return apiUnreadMessages;
    if (user.role === "client") {
      return getUnreadMessageCount(
        "client",
        bookings.map((booking) => booking.id)
      );
    }
    return getUnreadMessageCount("craftsman");
  }, [apiUnreadMessages, bookings, demoUnreadVersion, screen, user]);
  const activeBookingCount = useMemo(
    () =>
      bookings.filter((booking) => isActiveBookingStatus(booking.status)).length,
    [bookings]
  );
  const pendingCraftsmanRequestCount = useMemo(() => {
    if (!user || user.role !== "craftsman" || !isDemoDataMode) return 0;
    return dataService
      .getCraftsmanRequests()
      .filter((request) => request.status === "pending").length;
  }, [demoUnreadVersion, screen, user]);

  if (restoringSession) {
    return (
      <div
        style={{
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text2)",
          fontSize: 13,
          fontWeight: 850,
        }}
      >
        სესიის აღდგენა...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
        <LoginScreen
          onLogin={handleLogin}
          adminOnly={location.pathname === "/admin"}
          onExitAdmin={() => setBrowserPath("/login", true)}
        />
      </div>
    );
  }

  if (user.role === "admin") {
    return (
      <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
        <AdminScreen user={user} onLogout={handleLogout} />
      </div>
    );
  }

  const accountStatus = getCurrentAccountStatus();
  if (accountStatus === "blocked") {
    return (
      <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
        <BlockedAccountScreen role={user.role} onLogout={handleLogout} />
      </div>
    );
  }

  // ხელოსნის ვიუ
  if (user.role === "craftsman") {
    const craftsmanVerified =
      (isDemoDataMode
        ? dataService.getCraftsmanProfile().verificationStatus
        : apiWorkerVerificationStatus) === "verified";
    if (!craftsmanVerified && screen !== "user-profile") {
      return (
        <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
          <VerificationRequiredScreen
            onOpenProfile={() => navigate("user-profile")}
            onLogout={handleLogout}
          />
          <BottomNav
            active={screen}
            onNavigate={navigate}
            bookingCount={0}
            messageCount={0}
            searchLabel="საქმეები"
          />
        </div>
      );
    }
    return (
      <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
        {screen === "messages" ? (
          <MessagesScreen
            user={user}
            bookings={[]}
            craftsmanBookings={craftsmanBookings}
            onUnreadChange={handleUnreadChange}
            accountStatus={accountStatus}
            focusedBookingId={messageTargetBookingId}
          />
        ) : (
          <CraftsmanHomeScreen
            user={user}
            activeScreen={screen}
            onLogout={handleLogout}
            accountStatus={accountStatus}
            workerVerified={craftsmanVerified}
            onProfileUpdated={handleProfileUpdated}
            onOpenMessagesForBooking={(bookingId) => {
              setMessageTargetBookingId(bookingId);
              showScreen("messages");
            }}
          />
        )}
        <AccountStatusBanner status={accountStatus} />
        <BottomNav
          active={screen}
          onNavigate={navigate}
          bookingCount={pendingCraftsmanRequestCount}
          messageCount={unreadMessages}
          searchLabel="საქმეები"
        />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <AccountStatusBanner status={accountStatus} />
      {bookingActionError && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 18,
            right: 18,
            zIndex: 30,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 12,
            fontWeight: 850,
            lineHeight: 1.35,
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
          }}
        >
          {bookingActionError}
        </div>
      )}
      {screen === "home" && (
        <HomeScreen
          onWorkerSelect={goToWorker}
          onCategorySelect={goToCategory}
        />
      )}
      {screen === "search" && (
          <SearchScreen
            onWorkerSelect={goToWorker}
            onBack={() => showScreen("home")}
            initialCategory={searchCategory}
        />
      )}
      {screen === "profile" && selectedWorker && (
        <ProfileScreen
          worker={selectedWorker}
          onBack={() => showScreen(prevScreen)}
          onBooked={handleBooked}
          onOpenMessages={() => showScreen("messages")}
          hasBooked={bookings.some((booking) => booking.worker.id === selectedWorker.id)}
        />
      )}
      {screen === "bookings" && (
        <BookingsScreen
          bookings={bookings}
          isLoading={user?.role === "client" && !clientBookingsHydrated}
          onCancelBooking={handleCancelBooking}
          onChangeWorker={handleChangeBookingWorker}
          onReviewBooking={handleReviewBooking}
          onWorkerSelect={goToWorker}
          onProblemOpened={handleProblemOpened}
        />
      )}
      {screen === "messages" && (
        <MessagesScreen
          user={user}
          bookings={bookings}
          craftsmanBookings={craftsmanBookings}
          onUnreadChange={handleUnreadChange}
          accountStatus={accountStatus}
          focusedBookingId={messageTargetBookingId}
          onProblemOpened={handleProblemOpened}
        />
      )}
      {screen === "user-profile" && (
        <ProfileUserScreen
          user={user}
          onLogout={handleLogout}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
      {screen === "booking-confirm" && successData && (
        <SuccessScreen
          worker={successData.worker}
          day={successData.day}
          time={successData.time}
          dateLabel={successData.dateLabel}
          onDone={handleSuccessDone}
        />
      )}
      {showNav && (
        <BottomNav
          active={screen}
          onNavigate={navigate}
          bookingCount={activeBookingCount}
          messageCount={unreadMessages}
        />
      )}
    </div>
  );
};

export default App;
