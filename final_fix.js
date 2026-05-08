const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Correctly initialize the maps
const search = /const deductionMap = new Map<string, number>\(\);\s+for \(const p of allPayrollDeductions\) {\s+deductionMap\.set\(`${p\.driverId}-\${p\.weekNumber}`, p\.totalDeduction\);\s+}/;
const replacement = `const deductionMap = new Map<string, number>();
  const bonusMap = new Map<string, number>();
  for (const p of allPayrollDeductions) {
    deductionMap.set(\`\${p.driverId}-\${p.weekNumber}\`, p.totalDeduction);
    bonusMap.set(\`\${p.driverId}-\${p.weekNumber}\`, (p as any).totalBonus || 0);
  }`;

if (search.test(content)) {
    content = content.replace(search, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully initialized maps.');
} else {
    console.error('Pattern not found.');
}
