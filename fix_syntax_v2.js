const fs = require('fs');
const path = 'src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Use a more aggressive fix for the corrupted comment
// It's likely line 1036 in the current file.
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('* FIXED: This will now find the record and update it.')) {
        // Replace with the correct multi-line comment header
        lines[i] = '    /**\n     * FIXED: This will now find the record and update it.';
        break;
    }
}
content = lines.join('\n');

fs.writeFileSync(path, content, 'utf8');
console.log('Syntactical fix applied');
