const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

const targetLine = 'bonusMap.set(\\-\\, (p as any).totalBonus || 0);';
const correctLine = '    bonusMap.set(`${p.driverId}-${p.weekNumber}`, (p as any).totalBonus || 0);';

// Let's use a more robust replacement based on line context
const lines = content.split('\n');
let fixed = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('bonusMap.set(') && (lines[i].includes('\\-\\,') || lines[i].includes('${p.driverId}-'))) {
        lines[i] = correctLine;
        fixed = true;
    }
}

if (fixed) {
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Successfully fixed the corruption.');
} else {
    console.error('Could not find the corrupted line.');
}
