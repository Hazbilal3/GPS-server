const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix the missing select field
content = content.replace(
    /select: { totalDeduction: true },/g,
    'select: { totalDeduction: true, totalBonus: true },'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Select fix applied.');
