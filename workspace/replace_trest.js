const fs = require('fs');
let code = fs.readFileSync('src/components/GridOps.tsx', 'utf8');
code = code.replace(/label="T\. REST"/g, 'label="TEMP. REST"');
fs.writeFileSync('src/components/GridOps.tsx', code);
