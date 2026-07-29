export type WorkerStatus = "free" | "busy" | "booked";
export type Category =
  | "all"
  | "მალიარი"
  | "სანტექნიკოსი"
  | "ელექტრიკოსი"
  | "დურგალი"
  | "კაფელები";
export type UserRole = "client" | "craftsman" | "admin";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "en_route"
  | "started"
  | "worker_completed"
  | "client_confirmed"
  | "closed"
  | "completed"
  | "declined"
  | "cancelled"
  | "disputed";

export interface User {
  phone: string;
  role: UserRole;
  name?: string;
}

export interface Review {
  author: string;
  text: string;
  date: string;
  stars: number;
}

export interface Worker {
  id: number;
  backendId?: string;
  verificationStatus?: "not_started" | "not_submitted" | "pending" | "verified" | "rejected";
  name: string;
  role: string;
  avatar: string;
  avatarColor: string;
  exp: number;
  rating: number;
  reviewCount: number;
  status: WorkerStatus;
  city: string;
  phone: string;
  about: string;
  price: string;
  skills: string[];
  reviews: Review[];
  busyDays: number[];
}

export type Screen =
  | "home"
  | "search"
  | "messages"
  | "profile"
  | "bookings"
  | "booking-confirm"
  | "user-profile";
