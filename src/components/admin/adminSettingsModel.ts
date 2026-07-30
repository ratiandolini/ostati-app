import type { PlatformSettings } from "../../services/dataService";
import type { ProductionGuardItem } from "./adminProductionGuard";

export const updatePlatformNumberSetting = (
  current: PlatformSettings,
  key: keyof PlatformSettings,
  value: string
): PlatformSettings => {
  const numeric = Number(value);

  return {
    ...current,
    [key]: Number.isFinite(numeric) ? Math.max(0, numeric) : current[key],
  };
};

export const updatePlatformChoiceSetting = <Key extends keyof PlatformSettings>(
  current: PlatformSettings,
  key: Key,
  value: PlatformSettings[Key]
): PlatformSettings => ({
  ...current,
  [key]: value,
});

export const getProductionGuardMessages = (
  items: ProductionGuardItem[]
): string[] => items.map((item) => `${item.label}: ${item.detail}`);

export const getBlockedProductionModeMessage = (blockers: string[]) =>
  [
    "Production mode ჯერ ვერ ჩაირთვება.",
    "",
    ...blockers.map((item) => `- ${item}`),
    "",
    "ეს დაცვა გვიცავს იმ სიტუაციისგან, სადაც აპი რეალურ რეჟიმად ჩანს, მაგრამ launch checklist ბოლომდე მზად არ არის.",
  ].join("\n");
