const fs = require('fs');

let content = fs.readFileSync('src/components/AircraftsAdmin.tsx', 'utf8');

// 1. Remove TABS block
const tabsRegex = /\{\/\* TABS \*\/\}\s*<div className={`h-12 shrink-0 flex border-b [^\>]+>\s*<nav[\s\S]*?<\/nav>\s*<\/div>/g;
content = content.replace(tabsRegex, '');

// 2. Adjust Table Wrapper classes
// from `w-max border-r border-b text-left` to `w-1/2 border-r border-b text-left` (remove style too if present)
content = content.replace(/<div className={`w-max border-r border-b text-left \$\{isDarkMode \? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'\}`} style=\{\{ minWidth: '500px' \}\}>/, 
    '<div className={`w-1/2 overflow-auto border-r border-b text-left ${isDarkMode ? \'bg-slate-900 border-slate-800\' : \'bg-white border-slate-300\'}`}>');

// 3. Add the Logos Div at the end of the TABLE WRAPPER's inner table `</div>`
const tableEndTag = "</table>\n            </div>";
const logosDivHtml = `

            {/* LOGOS DIV */}
            <div className="w-1/2 p-2 flex flex-col items-center justify-start min-h-[500px] gap-2">
                 <div className={\`flex flex-col items-start justify-center p-3 w-full rounded-[3px] shadow-sm border shrink-0 \${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}\`}>
                     <div className="flex items-center justify-between w-full">
                         <h3 className={\`text-base font-black uppercase tracking-widest \${isDarkMode ? 'text-slate-300' : 'text-slate-700'}\`}>Companhias Aéreas</h3>
                         <button 
                            onClick={() => setShowNewAirlineModal(true)}
                            className={\`flex items-center justify-center p-1.5 rounded border transition-colors \${isDarkMode ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700' : 'bg-emerald-50 text-[#329858] border-emerald-200 hover:bg-emerald-100'}\`}
                            title="Adicionar nova companhia"
                         >
                            <Plus size={14} />
                         </button>
                     </div>
                     <p className={\`text-[10px] font-bold uppercase tracking-widest \${isDarkMode ? 'text-slate-500' : 'text-slate-400'}\`}>{airlines.filter(a => a && a !== 'EM GERAL').length} companhias cadastradas</p>
                 </div>
                 <div className={\`flex flex-wrap gap-4 justify-start content-start overflow-auto p-4 w-full flex-1 border-0 rounded-[3px] \${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}\`}>
                     {/* BOTAO EM GERAL */}
                     <div 
                         className={\`cursor-pointer flex-shrink-0 hover:scale-105 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center relative w-[60px] h-[60px] rounded \${activeAirline === 'EM GERAL' ? (isDarkMode ? 'ring-2 ring-emerald-500 bg-emerald-900/40 text-emerald-300' : 'ring-2 ring-emerald-500 bg-emerald-100 text-emerald-700') : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white shadow text-slate-500')}\`}
                         onClick={() => setActiveAirline('EM GERAL')} 
                         title="Exibir Todas as Aeronaves"
                     >
                         <Database size={24} className="mb-1 opacity-70" />
                         <span className="text-[8px] font-black uppercase text-center leading-none">TODOS</span>
                     </div>
                     
                     {airlines.filter(a => a && a !== 'EM GERAL').map(airline => {
                         const aircraftCount = aircrafts.filter(f => f.airline === airline).length;
                         const isActive = activeAirline === airline;
                         return (
                         <div key={airline} className={\`cursor-pointer flex-shrink-0 hover:scale-105 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center relative group \${isActive ? 'ring-2 ring-emerald-500 rounded' : ''}\`} onClick={() => setActiveAirline(airline)} title={\`\${airline} - \${aircraftCount} aeronaves\`}>
                             <AirlineLogo airlineCode={airline} className="w-[60px] h-[60px] rounded overflow-hidden shadow-sm ring-1 ring-black/5 flex items-center justify-center [&_img]:!w-[48px] [&_img]:!h-[48px]" showName={false} size="full" />
                             <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-white dark:bg-slate-800 text-[#2D8E48] dark:text-green-500 text-[8px] font-black rounded-full min-w-[18px] h-[18px] px-1 text-center shadow border border-slate-300 dark:border-slate-600 transition-transform group-hover:scale-110">
                                 {aircraftCount}
                             </div>
                         </div>
                         );
                     })}
                 </div>
            </div>`;

content = content.replace(tableEndTag, "</table>\n            </div>" + logosDivHtml);

fs.writeFileSync('src/components/AircraftsAdmin.tsx', content);
console.log('Layout updated.');
