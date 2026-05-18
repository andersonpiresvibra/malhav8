const fs = require('fs'); 
let file = 'src/components/GridOps.tsx'; 
let data = fs.readFileSync(file, 'utf8'); 

data = data.replace(
  'const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);', 
  'const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);\n  const [clickedRowId, setClickedRowId] = useState<string | null>(null);'
);

data = data.replaceAll(
  '<tr \n                          key={row.id} \n                          data-rowindex={rowIndex}', 
  '<tr \n                          key={row.id} \n                          data-rowindex={rowIndex}\n                          onClick={(e) => { e.stopPropagation(); setClickedRowId((prev) => prev === row.id ? null : row.id); }}'
);

data = data.replaceAll(
  "dynamicStatus?.rowClass ? dynamicStatus.rowClass : (isDarkMode ? '' : 'hover:bg-emerald-200')",
  "dynamicStatus?.rowClass ? dynamicStatus.rowClass : (isDarkMode ? (row.id === clickedRowId ? 'bg-slate-800' : '') : (row.id === clickedRowId ? 'bg-emerald-200' : 'hover:bg-emerald-200'))"
);

data = data.replaceAll(
  "${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-emerald-200'}",
  "${isDarkMode ? (row.id === clickedRowId ? 'border-slate-700 bg-gradient-to-b from-slate-700 to-slate-800' : 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800') : (row.id === clickedRowId ? 'border-emerald-300 bg-emerald-200' : 'border-slate-200 bg-white group-hover:bg-emerald-200')}"
);

// We should also ensure the script handles exact string matching gracefully
// For safety, let's write what was done.
fs.writeFileSync(file, data);
console.log('Patch complete.');
