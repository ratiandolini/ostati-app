import type { AdminAuditLog } from "../../services/dataService";

interface DemoAuditDataService {
  prependAdminAuditLog: (
    entry: Omit<AdminAuditLog, "id" | "createdAt">
  ) => void;
}

interface RecordDemoAdminAuditParams {
  isDemoDataMode: boolean;
  dataService: DemoAuditDataService;
  action: AdminAuditLog["action"];
  target: string;
  summary: string;
  adminName: string;
}

export const recordDemoAdminAudit = ({
  isDemoDataMode,
  dataService,
  action,
  target,
  summary,
  adminName,
}: RecordDemoAdminAuditParams) => {
  if (!isDemoDataMode) return;

  dataService.prependAdminAuditLog({
    action,
    target,
    summary,
    adminName,
  });
};

export const confirmAdminNoteAction = (
  message: string,
  adminNote: string,
  options?: { requireNote?: boolean }
) => {
  if (options?.requireNote && !adminNote.trim()) {
    window.alert("ამ მოქმედებისთვის ჯერ Admin ჩანაწერში მიუთითე მიზეზი.");
    return false;
  }

  return window.confirm(message);
};
