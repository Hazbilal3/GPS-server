const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix the specifically broken comment block
// Look for lines that start with * and then FIXED, but are missing the opening /**
content = content.replace(/\n\s*\*\s*FIXED: This will now find the record and update it\.\n\s*\*\//g, '\n  /**\n   * FIXED: This will now find the record and update it.\n   */');

fs.writeFileSync(path, content, 'utf8');
console.log('Syntax error fixed');
