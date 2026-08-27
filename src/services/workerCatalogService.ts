import { workers as demoWorkers } from "../data/workers";
import type { Worker, WorkerStatus } from "../types";
import { dataService, isDemoDataMode } from "./dataService";
import { createSupabaseRestClient } from "./supabaseRest";

interface SupabaseWorkerCard {
  id: string;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
  rating_avg: number | string | null;
  rating_count: number | null;
  city: string | null;
  about: string | null;
  price_type: "fixed" | "from" | "range" | null;
  price_min: number | string | null;
  price_max: number | string | null;
  experience_years: number | string | null;
  verification_status?: "not_started" | "pending" | "verified" | "rejected" | null;
  skills: string[] | null;
  schedule?: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
  }> | null;
  unavailable_ranges?: Array<{
    start: string;
    end: string;
  }> | null;
  booked_slots?: string[] | null;
}

const avatarColors = ["#17243a", "#2563eb", "#047857", "#b45309", "#7c3aed"];

const stableNumberId = (id: string) =>
  id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatPrice = (
  type: SupabaseWorkerCard["price_type"],
  min: SupabaseWorkerCard["price_min"],
  max: SupabaseWorkerCard["price_max"]
) => {
  const minValue = min == null ? null : Number(min);
  const maxValue = max == null ? null : Number(max);

  if (!minValue) return "ფასი შეთანხმებით";
  if (type === "range" && maxValue) return `${minValue}-${maxValue} ლარი`;
  if (type === "fixed") return `${minValue} ლარი`;
  return `${minValue} ლარიდან`;
};

const getSavedCraftsmanWorker = (): Worker | null => {
  const profile = dataService.getCraftsmanProfile();
  if (!profile.name && !profile.role && !profile.avatar) return null;
  if (profile.verificationStatus !== "verified") return null;

  return {
    id: 999,
    verificationStatus: "verified",
    name: profile.name || "გიორგი კურტანიძე",
    role: profile.role || "მალიარი",
    avatar: profile.avatar || "გკ",
    avatarColor: profile.avatarColor || "#17243a",
    exp: profile.experienceYears || 0,
    rating: profile.rating || 5,
    reviewCount: profile.reviewCount || 5,
    status: "free",
    city: profile.city || "თბილისი",
    phone: "",
    about:
      profile.extraWorkComment ||
      "პროფილი დამატებულია ხელოსნის პირადი კაბინეტიდან.",
    price: profile.price || "80-120 ლარი",
    skills: Array.isArray(profile.professions)
      ? profile.professions
      : ["ინტერიერი", "ფასადი", "შეკეთება"],
    busyDays: [12, 13, 19],
    reviews: [],
    schedule: profile.schedule || [],
    unavailableRanges: dataService.getCraftsmanUnavailableRanges(),
    bookedSlots: [],
  };
};

export const getDemoWorkerCatalog = (): Worker[] => {
  const savedCraftsman = getSavedCraftsmanWorker();
  const workers = savedCraftsman ? [savedCraftsman, ...demoWorkers] : demoWorkers;
  return workers.map((worker) => {
    const storedRating = dataService.getWorkerRating(worker.id);
    const normalizedWorker: Worker = {
      ...worker,
      verificationStatus: worker.verificationStatus || "verified",
    };
    return storedRating
      ? {
          ...normalizedWorker,
          rating: storedRating.value,
          reviewCount: storedRating.count,
        }
      : normalizedWorker;
  }).filter((worker) => worker.verificationStatus === "verified");
};

const mapSupabaseWorker = (row: SupabaseWorkerCard, index: number): Worker => {
  const name = row.name || "ხელოსანი";
  const skills = row.skills?.length
    ? row.skills
    : row.role
      ? [row.role]
      : ["რემონტი"];
  const status: WorkerStatus = "free";

  return {
    id: stableNumberId(row.id),
    backendId: row.id,
    verificationStatus: row.verification_status || "not_started",
    name,
    role: row.role || skills[0] || "ხელოსანი",
    avatar: row.avatar_url || initialsFromName(name),
    avatarColor: avatarColors[index % avatarColors.length],
    exp: Number(row.experience_years || 0),
    rating: Number(row.rating_avg || 0),
    reviewCount: row.rating_count || 0,
    status,
    city: row.city || "თბილისი",
    phone: "",
    about: row.about || "ხელოსნის პროფილი მალე შეივსება.",
    price: formatPrice(row.price_type, row.price_min, row.price_max),
    skills,
    busyDays: [],
    reviews: [],
    schedule:
      row.schedule?.map((item) => ({
        weekday: Number(item.weekday),
        startTime: String(item.start_time || "").slice(0, 5),
        endTime: String(item.end_time || "").slice(0, 5),
      })) || [],
    unavailableRanges: row.unavailable_ranges || [],
    bookedSlots: row.booked_slots || [],
  };
};

export const loadWorkerCatalog = async (
  signal?: AbortSignal
): Promise<Worker[]> => {
  if (isDemoDataMode) return getDemoWorkerCatalog();

  const client = createSupabaseRestClient();
  let rows: SupabaseWorkerCard[];
  try {
    rows = await client.rpc<SupabaseWorkerCard[]>(
      "get_public_worker_cards",
      {},
      { signal }
    );
  } catch {
    rows = await client.select<SupabaseWorkerCard>("worker_cards", {
      select: "*",
      order: "rating_avg.desc.nullslast,rating_count.desc",
    }, { signal });
  }

  return rows
    .filter((row) => row.verification_status === "verified")
    .sort((a, b) => Number(b.rating_avg || 0) - Number(a.rating_avg || 0))
    .map(mapSupabaseWorker);
};
