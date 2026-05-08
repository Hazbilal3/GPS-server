const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Clean up ALL non-breaking spaces and replace with regular spaces
content = content.replace(/\u00A0/g, ' ');

// 2. Fix the getDailyPayroll calculation logic
// Search for the block starting with // --- NEW: Prorate the deduction ---
const searchPattern = /\/\/ --- NEW: Prorate the deduction ---[\s\S]+?\/\/ --- End of new logic ---/;
const replacement = `// --- NEW: Prorate the deduction ---
      const { key: currentWeekKey } = getPayrollWeekKey(
        new Date(date),
      );
      const daysInThisWeek = daysPerWeek.get(currentWeekKey)?.size || 1;
      const weeklyDeduction =
        deductionMap.get(\`\${driverId}-\${currentWeekKey}\`) || 0;
      const weeklyBonus =
        bonusMap.get(\`\${driverId}-\${currentWeekKey}\`) || 0;
      const proratedDeduction = weeklyDeduction / daysInThisWeek;
      const proratedBonus = weeklyBonus / daysInThisWeek;
      const netPay = subtotal - proratedDeduction + proratedBonus;
      // --- End of new logic ---`;

if (searchPattern.test(content)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully cleaned non-breaking spaces and updated calculation logic.');
} else {
    console.error('Could not find the target calculation block.');
    console.log('Sample content around expected area:');
    const start = content.indexOf('// --- NEW: Prorate the deduction ---');
    if (start !== -1) {
        console.log(content.substring(start, start + 300));
    }
}
