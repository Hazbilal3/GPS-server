const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getPayrollWeekKey(date) {
  const tempDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = tempDate.getUTCDay(); // 0=Sun, 6=Sat

  const daysToAdd = (5 - dayNum + 7) % 7;

  const periodEnd = new Date(tempDate);
  periodEnd.setUTCDate(tempDate.getUTCDate() + daysToAdd); // This is the Friday (end)

  const tempDateWeek = new Date(
    Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate()),
  );
  const dayNumWeek = tempDateWeek.getUTCDay() || 7;
  tempDateWeek.setUTCDate(tempDateWeek.getUTCDate() + 4 - dayNumWeek);
  const yearStart = new Date(Date.UTC(tempDateWeek.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((tempDateWeek.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  const year = periodEnd.getUTCFullYear();
  const key = year * 100 + week;
  return { key };
}

async function main() {
  const drivers = await prisma.user.findMany({ where: { driverId: 12345 } });
  const driverIds = drivers.map(d => d.driverId).filter(Boolean);
  
  const allPayrollDeductions = await prisma.payroll.findMany({
    where: { driverId: { in: driverIds } },
    select: { driverId: true, weekNumber: true, totalDeduction: true, totalBonus: true },
  });

  console.log("PAYROLL DEDUCTIONS DB:", allPayrollDeductions);

  const deductionMap = new Map();
  const bonusMap = new Map();
  for (const p of allPayrollDeductions) {
    deductionMap.set(`${p.driverId}-${p.weekNumber}`, p.totalDeduction);
    bonusMap.set(`${p.driverId}-${p.weekNumber}`, p.totalBonus || 0);
  }

  const allUploads = await prisma.upload.findMany({
    where: { driverId: 12345, lastevent: { contains: 'delivered', mode: 'insensitive' } },
  });

  const daysPerWeek = new Map();
  for (const upload of allUploads) {
    const dateKey = upload.createdAt.toISOString().split('T')[0];
    const { key: weekKey } = await getPayrollWeekKey(upload.createdAt);
    if (!daysPerWeek.has(weekKey)) daysPerWeek.set(weekKey, new Set());
    daysPerWeek.get(weekKey).add(dateKey);
  }

  console.log("DAYS PER WEEK:", daysPerWeek);
  
  const uploadsByDay = new Map();
  for (const upload of allUploads) {
    const dateKey = upload.createdAt.toISOString().split('T')[0];
    if (!uploadsByDay.has(dateKey)) {
      uploadsByDay.set(dateKey, []);
    }
    uploadsByDay.get(dateKey).push(upload);
  }

  const dailyRecords = [];
  for (const [date, dayUploads] of uploadsByDay.entries()) {
    const { key: currentWeekKey } = await getPayrollWeekKey(new Date(date));
    const daysInThisWeek = daysPerWeek.get(currentWeekKey)?.size || 1;
    const weeklyDeduction = deductionMap.get(`12345-${currentWeekKey}`) || 0;
    const weeklyBonus = bonusMap.get(`12345-${currentWeekKey}`) || 0;
    console.log(`Date: ${date}, WeekKey: ${currentWeekKey}, Days: ${daysInThisWeek}, Deduct: ${weeklyDeduction}, Bonus: ${weeklyBonus}`);
  }
}

main().finally(() => prisma.$disconnect());
