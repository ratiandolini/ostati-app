import { dataService } from "../../services/dataService";

export const prependDemoBookingNotification = (
  bookingId: string,
  title: string,
  text: string
) => {
  dataService.prependClientNotification({
    id: `${bookingId}-notice-${Date.now()}`,
    bookingId,
    type: "confirmed",
    title,
    text,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
};

export const prependDemoCraftsmanNotification = (
  bookingId: string,
  title: string,
  text: string,
  sourceType?: string
) => {
  dataService.prependCraftsmanNotification({
    id: `${bookingId}-craftsman-notice-${Date.now()}`,
    bookingId,
    type: "confirmed",
    sourceType,
    title,
    text,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
};
