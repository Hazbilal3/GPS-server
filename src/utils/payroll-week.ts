export function getISOWeek(date: Date): number {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getPayrollWeekKey(date: Date): { key: number; periodStart: Date; periodEnd: Date } {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay();
  const daysToAdd = (5 - dayNum + 7) % 7;
  const periodEnd = new Date(tempDate);
  periodEnd.setUTCDate(tempDate.getUTCDate() + daysToAdd);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodEnd.getUTCDate() - 6);
  const year = periodEnd.getUTCFullYear();
  const week = getISOWeek(periodEnd);
  const key = year * 100 + week;
  return { key, periodStart, periodEnd };
}
