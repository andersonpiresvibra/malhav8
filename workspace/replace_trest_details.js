const fs = require('fs');
let code = fs.readFileSync('src/components/FlightDetailsModal.tsx', 'utf8');
code = code.replace(/T\. Rest\./g, 'Temp. Rest');
fs.writeFileSync('src/components/FlightDetailsModal.tsx', code);
