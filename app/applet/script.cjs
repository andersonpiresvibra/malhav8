const fs = require('fs');
let code = fs.readFileSync('src/components/GridOps.tsx', 'utf8');
code = code.replace(/label="T\. REST"/g, 'label="Temp. Rest"');
fs.writeFileSync('src/components/GridOps.tsx', code);
