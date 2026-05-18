const fs = require('fs');
let file = 'src/components/GridOps.tsx';
let data = fs.readFileSync(file, 'utf8');

// The main string repeated 15 times:
const oldTdPattern = "(row.id === clickedRowId ? 'border-slate-700 bg-gradient-to-b from-slate-700 to-slate-800' : 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800') : (row.id === clickedRowId ? 'border-emerald-300 bg-emerald-200' : 'border-slate-200 bg-white group-hover:bg-emerald-200')";

const newTdPattern = "(row.id === clickedRowId ? 'border-emerald-500/80 bg-gradient-to-b from-emerald-900/60 to-emerald-800/60' : 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-emerald-900/30 group-hover:to-emerald-800/30 group-hover:border-emerald-500/30') : (row.id === clickedRowId ? 'border-emerald-400 bg-emerald-300' : 'border-slate-200 bg-white group-hover:bg-emerald-200')";

data = data.replaceAll(oldTdPattern, newTdPattern);

// The tr pattern
const oldTrPattern = "dynamicStatus?.rowClass ? dynamicStatus.rowClass : (isDarkMode ? (row.id === clickedRowId ? 'bg-slate-800' : '') : (row.id === clickedRowId ? 'bg-emerald-200' : 'hover:bg-emerald-200'))";

const newTrPattern = "dynamicStatus?.rowClass ? dynamicStatus.rowClass : (isDarkMode ? (row.id === clickedRowId ? 'bg-emerald-900/60' : 'hover:bg-emerald-900/30') : (row.id === clickedRowId ? 'bg-emerald-300' : 'hover:bg-emerald-200'))";

data = data.replaceAll(oldTrPattern, newTrPattern);

fs.writeFileSync(file, data);
console.log('Colors boosted and applied successfully.');
