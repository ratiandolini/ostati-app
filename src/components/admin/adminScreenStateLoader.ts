import {
  loadAdminBookings,
  loadAdminDisputes,
  loadAdminLaunchState,
  loadAdminUsers,
  loadCurrentAdminContext,
} from "../../services/adminApiService";
import type {
  AdminLaunchState,
  AdminUserSummary,
  CurrentAdminContext,
} from "../../services/adminApiService";
import type { BookingDispute } from "../../services/dataService";
import type { AdminPermission } from "./adminPermissions";

type PromiseValue<T> = T extends Promise<infer Value> ? Value : T;

export interface AdminScreenApiState {
  context: CurrentAdminContext;
  state: AdminLaunchState;
  adminBookings: PromiseValue<ReturnType<typeof loadAdminBookings>> | null;
  adminDisputes: BookingDispute[];
  adminUsers: AdminUserSummary[];
}

export const adminContextCan = (
  context: CurrentAdminContext,
  permission: AdminPermission
) =>
  context.member.role === "owner" ||
  context.member.permissions.includes(permission);

export const loadAdminScreenApiState =
  async (): Promise<AdminScreenApiState> => {
    const context = await loadCurrentAdminContext();
    const contextCan = (permission: AdminPermission) =>
      adminContextCan(context, permission);
    const [state, adminBookings, adminDisputes, adminUsers] =
      await Promise.all([
        loadAdminLaunchState(),
        contextCan("bookings") || contextCan("finance") || contextCan("disputes")
          ? loadAdminBookings()
          : Promise.resolve(null),
        contextCan("disputes") || contextCan("finance")
          ? loadAdminDisputes()
          : Promise.resolve([]),
        contextCan("users") ? loadAdminUsers() : Promise.resolve([]),
      ]);

    return {
      context,
      state,
      adminBookings,
      adminDisputes,
      adminUsers,
    };
  };
