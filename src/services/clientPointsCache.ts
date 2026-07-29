import type { ClientPoints } from "./appStorage";

const storageKey = (userKey: string) => `clientPointsAwarded:${userKey}`;
const emptyPoints = (): ClientPoints => ({ total: 0, history: [] });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeClientPoints = (value: unknown): ClientPoints => {
  if (!isRecord(value)) return emptyPoints();

  const total = Number(value.total);
  const history = Array.isArray(value.history)
    ? value.history
        .filter(isRecord)
        .map((item) => {
          const points = Number(item.points);
          return {
            id: typeof item.id === "string" ? item.id : "",
            points: Number.isFinite(points) ? points : 0,
            reason: typeof item.reason === "string" ? item.reason : "",
            createdAt:
              typeof item.createdAt === "string"
                ? item.createdAt
                : new Date(0).toISOString(),
          };
        })
        .filter((item) => item.id)
    : [];

  return {
    total: Number.isFinite(total) ? total : 0,
    history,
  };
};

const readAwarded = (userKey: string): ClientPoints => {
  if (!userKey || typeof window === "undefined") {
    return emptyPoints();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return emptyPoints();
    const parsed: unknown = JSON.parse(raw);
    return normalizeClientPoints(parsed);
  } catch {
    window.localStorage.removeItem(storageKey(userKey));
    return emptyPoints();
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
