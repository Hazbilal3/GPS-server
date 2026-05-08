const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Update selection to include totalBonus
content = content.replace(
    /const allPayrollDeductions = await this\.prisma\.payroll\.findMany\({\s+where: { driverId: { in: driverIds } },\s+select: { driverId: true, weekNumber: true, totalDeduction: true \},\s+}\);/g,
    'const allPayrollDeductions = await this.prisma.payroll.findMany({\n    where: { driverId: { in: driverIds } },\n    select: { driverId: true, weekNumber: true, totalDeduction: true, totalBonus: true },\n  });'
);

// 2. Add bonusMap initialization
content = content.replace(
    /\/\/ Key: "driverId-weekKey", Value: totalDeduction\s+const deductionMap = new Map<string, number>\(\);\s+for \(const p of allPayrollDeductions\) {\s+deductionMap\.set\(`${p\.driverId}-\${p\.weekNumber}`, p\.totalDeduction\);\s+}/g,
    '// Key: "driverId-weekKey", Value: totalDeduction/totalBonus\n  const deductionMap = new Map<string, number>();\n  const bonusMap = new Map<string, number>();\n  for (const p of allPayrollDeductions) {\n    deductionMap.set(`${p.driverId}-${p.weekNumber}`, p.totalDeduction);\n    bonusMap.set(`${p.driverId}-${p.weekNumber}`, (p as any).totalBonus || 0);\n  }'
);

// 3. Update result record type definition
content = content.replace(
    /const dailyRecords: {\s+driverId: number;\s+driverName: string \| null;\s+date: string;\s+totalStops: number;\s+subtotal: number; \/\/ <-- Renamed from amount\s+deduction: number; \/\/ <-- NEW\s+netPay: number; \/\/ <-- NEW\s+}\[] = \[];/g,
    'const dailyRecords: {\n    driverId: number;\n    driverName: string | null;\n    date: string;\n    totalStops: number;\n    subtotal: number;\n    deduction: number;\n    bonus: number; // <-- NEW\n    netPay: number;\n  }[] = [];'
);

// 4. Update calculation logic (prorate bonus and correct netPay)
content = content.replace(
    /const weeklyDeduction =\s+deductionMap\.get\(`${driverId}-\${currentWeekKey}`\) \|\| 0;\s+const proratedDeduction = weeklyDeduction \/ daysInThisWeek;\s+const netPay = subtotal - proratedDeduction;/g,
    'const weeklyDeduction =\n        deductionMap.get(`${driverId}-${currentWeekKey}`) || 0;\n      const weeklyBonus =\n        bonusMap.get(`${driverId}-${currentWeekKey}`) || 0;\n      const proratedDeduction = weeklyDeduction / daysInThisWeek;\n      const proratedBonus = weeklyBonus / daysInThisWeek;\n      const netPay = subtotal - proratedDeduction + proratedBonus;'
);

// 5. Update object push
content = content.replace(
    /dailyRecords\.push\({\s+driverId,\s+driverName: driver\.fullName,\s+date,\s+totalStops,\s+subtotal: Number\(subtotal\.toFixed\(2\)\), \/\/ <-- Updated\s+deduction: Number\(proratedDeduction\.toFixed\(2\)\), \/\/ <-- New\s+netPay: Number\(netPay\.toFixed\(2\)\), \/\/ <-- New\s+}\);/g,
    'dailyRecords.push({\n        driverId,\n        driverName: driver.fullName,\n        date,\n        totalStops,\n        subtotal: Number(subtotal.toFixed(2)),\n        deduction: Number(proratedDeduction.toFixed(2)),\n        bonus: Number(proratedBonus.toFixed(2)),\n        netPay: Number(netPay.toFixed(2)),\n      });'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Backend getDailyPayroll updated successfully.');
