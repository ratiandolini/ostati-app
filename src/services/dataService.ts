import { appStorage } from "./appStorage";
import { apiService } from "./apiService";
import type {
  BookingDispute,
  BookingMessage,
  BookingReview,
  ClientReview,
  AdminAuditLog,
  AdminMember,
  ClientNotification,
  ClientProfile,
  CraftsmanBookingRequest,
  CraftsmanProfile,
  LegalSettings,
  MobileQaScenario,
  PlatformSettings,
  PrePaymentChecklistItem,
  UnavailableRange,
} from "./appStorage";

export type {
  BookingDispute,
  BookingMessage,
  BookingReview,
  ClientReview,
  AdminAuditLog,
  AdminMember,
  ClientNotification,
  ClientProfile,
  CraftsmanBookingRequest,
  CraftsmanProfile,
  LegalSettings,
  MobileQaScenario,
  PlatformSettings,
  PrePaymentChecklistItem,
  UnavailableRange,
};

type DataMode = "demo" | "api";

const dataMode: DataMode =
  process.env.REACT_APP_DATA_MODE === "api" ? "api" : "demo";

export const dataService = dataMode === "api" ? apiService : appStorage;
export const isDemoDataMode = dataMode === "demo";
