const fs = require('fs');

let content = fs.readFileSync('src/components/GridOps.tsx', 'utf-8');

// Replace all occurrences of the DESIGNAR button
content = content.replace(/className="inline-flex items-center justify-center gap-1\.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1\.5 rounded shadow-lg shadow-indigo-600\/20 transition-all active:scale-95 w-full mx-auto"/g, 
"className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded shadow-lg transition-all active:scale-95 w-full mx-auto ${dynamicStatus?.label === 'ATRASADO' ? 'bg-[#E7000B] hover:bg-red-700 text-white shadow-red-600/20 border border-[#ff6c6c]' : 'bg-[#8b9ae6] hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}");

// Replace remaining occurrences of the CITY cell
content = content.replace(/className={\`px-2 border-y border-l \\\${isDarkMode \? \(row\.id === clickedRowId \? 'border-emerald-500\\/80 bg-gradient-to-b from-emerald-900\\/60 to-emerald-800\\/60' : 'border-slate-700\\/50 bg-gradient-to-b from-slate-800\\/50 to-slate-900\\/80 group-hover:from-emerald-900\\/30 group-hover:to-emerald-800\\/30 group-hover:border-emerald-500\\/30'\) : \(row\.id === clickedRowId \? 'border-emerald-400 bg-emerald-300' : 'border-slate-200 bg-white group-hover:bg-emerald-200'\)} transition-all text-center font-black text-\[9px\] \\\${isDarkMode \? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight\`}/g,
"className={`px-2 border-y border-l ${isDarkMode ? (row.id === clickedRowId ? 'border-emerald-500/80 bg-gradient-to-b from-emerald-900/60 to-emerald-800/60' : 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-emerald-900/30 group-hover:to-emerald-800/30 group-hover:border-emerald-500/30') : (row.id === clickedRowId ? 'border-emerald-400 bg-emerald-300' : 'border-slate-200 bg-white group-hover:bg-emerald-200')} transition-all text-center font-black text-[9px] ${dynamicStatus?.label === 'ATRASADO' ? (isDarkMode ? '!text-slate-100' : '!text-[#000000]') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')} uppercase tracking-tight`}");

fs.writeFileSync('src/components/GridOps.tsx', content);
