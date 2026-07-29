import type { ClientPoints } from "./appStorage";

const storageKey = (userKey: string) => `clientPointsAwarded:${userKey}`;

const readAwarded = (userKey: string): ClientPoints => {
  if (!userKey || typeof window === "undefined") {
    return { total: 0, history: [] };
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return { total: 0, history: [] };
    const parsed = JSON.parse(raw) as ClientPoints;
    return {
      total: Number(parsed.total || 0),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { total: 0, history: [] };
  }
};

export const rememberClientReviewPoints = (
  userKey: string,
  bookingId: string,
  points = 10,
  reason = "ხელოსნის შეფასება დასრულებული ჯავშნის შემდეგ"
) => {
  if (!userKey || !bookingId || typeof window === "undefined") return;

  const current = readAwarded(userKey);
  if (current.history.some((item) => item.id === bookingId)) return;

  const next: ClientPoints = {
    total: current.total + points,
    history: [
      {
        id: bookingId,
        points,
        reason,
        createdAt: new Date().toISOString(),
      },
      ...current.history,
    ].slice(0, 20),
  };

  window.localStorage.setItem(storageKey(userKey), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("client-points-updated"));
};

export const mergeClientPointsWithLocalAwards = (
  userKey: string,
  serverPoints: ClientPoints
): ClientPoints => {
  const local = readAwarded(userKey);
  if (!local.history.length) return serverPoints;

  const serverTotal = Number(serverPoints.total || 0);
  if (serverTotal >= local.total) {
    return serverPoints;
  }

  return {
    total: local.total,
    history: local.history,
  };
};
