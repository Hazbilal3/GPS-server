const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Office\\GPS- carlos\\GPS\\backend\\src\\upload\\upload.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update PayrollRecord interface
const interfaceRegex = /export interface PayrollRecord \{[\s\S]*?totalDeduction: number;([\s\S]*?)netPay: number;/;
if (interfaceRegex.test(content)) {
    content = content.replace(interfaceRegex, (match, p1) => {
        if (match.includes('totalBonus: number;')) return match;
        return match.replace('totalDeduction: number;', 'totalDeduction: number;\n  totalBonus: number;');
    });
    console.log('Updated PayrollRecord interface.');
} else {
    console.log('Could not find PayrollRecord interface.');
}

// 2. Ensure getDailyPayroll selects totalBonus
const selectRegex = /select:\s*\{\s*driverId: true,\s*weekNumber: true,\s*totalDeduction: true\s*\}/g;
if (selectRegex.test(content)) {
    content = content.replace(selectRegex, 'select: { driverId: true, weekNumber: true, totalDeduction: true, totalBonus: true }');
    console.log('Updated prisma.payroll.findMany select in getDailyPayroll.');
}

// 3. Ensure bonusMap is populated correctly
// This part is likely already there but I want to be sure it's correct.
// Line 1114: bonusMap.set(`${p.driverId}-${p.weekNumber}`, (p as any).totalBonus || 0);

// 4. Ensure netPay calculation in getDailyPayroll uses bonus
const netPayCalcRegex = /const netPay = subtotal - proratedDeduction;/g;
if (netPayCalcRegex.test(content)) {
     content = content.replace(netPayCalcRegex, 'const netPay = subtotal - proratedDeduction + proratedBonus;');
     console.log('Updated netPay calculation in getDailyPayroll.');
}

// 5. Ensure rounding for bonus in dailyRecords.push
const dailyPushRegex = /deduction: Number\(proratedDeduction\.toFixed\(2\)\),/g;
if (dailyPushRegex.test(content)) {
    content = content.replace(dailyPushRegex, 'deduction: Number(proratedDeduction.toFixed(2)),\n        bonus: Number(proratedBonus.toFixed(2)),');
    console.log('Updated dailyRecords.push to include rounded bonus.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied all fixes to upload.service.ts');
