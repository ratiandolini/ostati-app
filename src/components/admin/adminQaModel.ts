import {
  qaAreaLabel,
  qaAreaOrder,
} from "./adminQaConfig";
import type {
  MobileQaScenario,
  PrePaymentChecklistItem,
} from "../../services/dataService";

interface AdminQaModelInput {
  prePaymentChecklist: PrePaymentChecklistItem[];
  mobileQaScenarios: MobileQaScenario[];
}

export const getAdminQaModel = ({
  prePaymentChecklist,
  mobileQaScenarios,
}: AdminQaModelInput) => {
  const mobileQaDoneCount = mobileQaScenarios.filter((item) => item.done).length;
  const mobileQaNotes = mobileQaScenarios
    .filter((item) => Boolean(item.note?.trim()))
    .map((item) => ({
      id: item.id,
      area: qaAreaLabel[item.area],
      label: item.label,
      done: item.done,
      note: item.note?.trim() || "",
    }));
  const prePaymentDoneCount = prePaymentChecklist.filter((item) => item.done)
    .length;
  const mobileQaProgressByArea = qaAreaOrder.map((area) => {
    const items = mobileQaScenarios.filter((item) => item.area === area);
    const done = items.filter((item) => item.done).length;
    return {
      area,
      label: qaAreaLabel[area],
      done,
      total: items.length,
      complete: items.length > 0 && done === items.length,
    };
  });
  const remainingMobileQaScenarios = mobileQaScenarios.filter(
    (item) => !item.done
  );

  return {
    mobileQaDoneCount,
    mobileQaNotes,
    prePaymentDoneCount,
    mobileQaProgressByArea,
    remainingMobileQaScenarios,
    nextMobileQaScenario: remainingMobileQaScenarios[0],
  };
};
