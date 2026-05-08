const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace all non-breaking spaces (U+00A0) with regular spaces (U+0020)
content = content.replace(/\u00A0/g, ' ');

fs.writeFileSync(path, content, 'utf8');
console.log('Non-breaking spaces cleaned');
