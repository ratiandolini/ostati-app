// Demo-mode data-change events ("client-bookings-updated",
// "craftsman-bookings-updated", "booking-status-updated") are broadcast on
// `window` and picked up by whichever role is currently logged in. Several
// of them (most importantly "booking-status-updated") carry a `target`
// telling which side the change is actually for.
//
// A listener must ignore an event whose `target` names the other role —
// otherwise a craftsman-targeted event fired mid-way through an unrelated
// action (e.g. a client booking a job also writes the mirrored
// craftsman-side request and a craftsman-targeted notification) makes the
// client re-read localStorage before its own just-created booking has been
// persisted, silently discarding it.
export const shouldRefreshForRole = (
  event: Event,
  role: "client" | "craftsman"
): boolean => {
  const target = (event as CustomEvent<{ target?: string }>).detail?.target;
  return !target || target === role;
};
