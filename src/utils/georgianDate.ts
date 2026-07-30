const englishDateParts: Array<[RegExp, string]> = [
  [/\bJanuary\b/gi, "იანვარი"],
  [/\bFebruary\b/gi, "თებერვალი"],
  [/\bMarch\b/gi, "მარტი"],
  [/\bApril\b/gi, "აპრილი"],
  [/\bMay\b/gi, "მაისი"],
  [/\bJune\b/gi, "ივნისი"],
  [/\bJuly\b/gi, "ივლისი"],
  [/\bAugust\b/gi, "აგვისტო"],
  [/\bSeptember\b/gi, "სექტემბერი"],
  [/\bOctober\b/gi, "ოქტომბერი"],
  [/\bNovember\b/gi, "ნოემბერი"],
  [/\bDecember\b/gi, "დეკემბერი"],
  [/\bJan\b/gi, "იან"],
  [/\bFeb\b/gi, "თებ"],
  [/\bMar\b/gi, "მარ"],
  [/\bApr\b/gi, "აპრ"],
  [/\bJun\b/gi, "ივნ"],
  [/\bJul\b/gi, "ივლ"],
  [/\bAug\b/gi, "აგვ"],
  [/\bSep\b/gi, "სექ"],
  [/\bOct\b/gi, "ოქტ"],
  [/\bNov\b/gi, "ნოე"],
  [/\bDec\b/gi, "დეკ"],
  [/\bMonday\b/gi, "ორშაბათი"],
  [/\bTuesday\b/gi, "სამშაბათი"],
  [/\bWednesday\b/gi, "ოთხშაბათი"],
  [/\bThursday\b/gi, "ხუთშაბათი"],
  [/\bFriday\b/gi, "პარასკევი"],
  [/\bSaturday\b/gi, "შაბათი"],
  [/\bSunday\b/gi, "კვირა"],
  [/\bMon\b/gi, "ორშ"],
  [/\bTue\b/gi, "სამ"],
  [/\bWed\b/gi, "ოთხ"],
  [/\bThu\b/gi, "ხუთ"],
  [/\bFri\b/gi, "პარ"],
  [/\bSat\b/gi, "შაბ"],
  [/\bSun\b/gi, "კვ"],
];

export const normalizeGeorgianDateLabel = (value: string) =>
  englishDateParts.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value
  );

export const georgianMonthNames = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

export const georgianShortMonthNames = [
  "იან",
  "თებ",
  "მარ",
  "აპრ",
  "მაის",
  "ივნ",
  "ივლ",
  "აგვ",
  "სექ",
  "ოქტ",
  "ნოე",
  "დეკ",
];

export const formatGeorgianDate = (value: string | Date, options?: { shortMonth?: boolean; year?: boolean }) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeGeorgianDateLabel(String(value || ""));
  const months = options?.shortMonth ? georgianShortMonthNames : georgianMonthNames;
  const year = options?.year === false ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${months[date.getMonth()]}${year}`;
};

export const formatGeorgianTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ka-GE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
