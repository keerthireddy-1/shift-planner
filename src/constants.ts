export const INDIAN_HOLIDAYS = [
  "2026-01-26", // Republic Day
  "2026-05-01", // Labor Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-12-25", // Christmas
  "2026-05-25", // Mock Holiday
];

export const getDayInfo = (date: Date) => {
  const dateStr = date.toISOString().split('T')[0];
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  if (INDIAN_HOLIDAYS.includes(dateStr)) {
    return { isNonWorking: true, label: "Public Holiday" };
  }
  if (day === 0 || day === 6) {
    return { isNonWorking: true, label: "Weekend" };
  }
  return { isNonWorking: false, label: "" };
};

export const isNonWorkingDay = (date: Date) => getDayInfo(date).isNonWorking;
