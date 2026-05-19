const fs = require('fs');

let code = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

const startTag = '<div id="printable-report-container" className="print-report w-[210mm] min-h-[297mm] bg-white text-slate-950 p-12 shadow-2xl rounded-sm flex flex-col font-sans">';
const endTagMarker = '                </div>\n            </div>\n        ) : (\n            // === LISTA DE RELATÓRIOS (DASHBOARD) ===';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTagMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Tags not found!");
    process.exit(1);
}

const before = code.substring(0, startIndex + startTag.length);
const after = code.substring(endIndex);

const newContent = `
                    
                    {/* CABEÇALHO DO DOCUMENTO EMPRESARIAL */}
                    <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                                <FileBarChart size={28} className="text-slate-900" />
                                RELATÓRIO DE AUDITORIA
                            </h1>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                                BR Aviation • JETFUEL-SIM / Sistema de Controle NOC
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                             <div className="font-mono text-[10px] text-slate-500 mb-1 tracking-widest">DOC. REF: {selectedFlight.id.split('-')[0]}-{selectedFlight.id.split('-')[1]?.substring(0,4).toUpperCase()}</div>
                             <div className="bg-slate-900 text-white px-3 py-1 font-mono text-xl font-black rounded-sm inline-block">
                                {selectedFlight.flightNumber}
                             </div>
                        </div>
                    </div>

                    {/* DADOS CADASTRAIS (GRID TABULAR FECHADO) */}
                    <div className="mb-6 border-2 border-slate-900 rounded-sm overflow-hidden">
                        <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex justify-between">
                            <span>1.0 / Informações da Missão</span>
                            <span>DATA DE REFERÊNCIA: {selectedFlight.date}</span>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-y divide-slate-300 bg-white text-sm">
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">COMPANHIA</span>
                                <span className="font-black text-slate-900 uppercase truncate block">{selectedFlight.airline} ({selectedFlight.airlineCode})</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">AERONAVE / REG.</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.registration}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">MODELO ICAO</span>
                                <span className="font-black text-slate-900 truncate block">{selectedFlight.model}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">ROTA / TRONCO</span>
                                <span className="font-black text-slate-900 truncate block">{selectedFlight.origin || 'N/A'} / {selectedFlight.destination}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">POSIÇÃO (PÁTIO)</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.positionId}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">ETD (SAÍDA PRESUMIDA)</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.etd}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">FROTA / OPERAÇÃO</span>
                                <span className="font-black text-slate-900 uppercase truncate block">{selectedFlight.fleet ? \`CTA-\${selectedFlight.fleet}\` : 'REDE HIDRANTE'}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">EQP. / VEÍCULO</span>
                                <span className="font-black text-slate-900 uppercase truncate block">{selectedFlight.vehicleType || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* EXECUÇÃO E VOLUMETRIA EM DUAS COLUNAS */}
                    <div className="flex gap-4 mb-6">
                        {/* LEFT: TIMELINE DE OPERAÇÃO */}
                        <div className="flex-1 border-2 border-slate-900 rounded-sm overflow-hidden flex flex-col">
                            <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                2.0 / Linha de Tempos Oficiais
                            </div>
                            <table className="w-full text-left bg-white text-sm">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Hora Confirmação</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.designationTime ? selectedFlight.designationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Início Bombeamento</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.startTime ? selectedFlight.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Término Real</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.endTime ? selectedFlight.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2 bg-slate-50 border-t-2 border-slate-900">Operador NOC</td>
                                        <td className="px-3 py-1.5 text-right bg-slate-50 border-t-2 border-slate-900">
                                            <span className="font-bold text-slate-900 text-[10px] px-2 py-0.5 bg-slate-200 rounded-sm inline-block">
                                                {selectedFlight.operator || 'NÃO DESIGNADO'}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* RIGHT: VOLUMETRIA */}
                        <div className="flex-1 border-2 border-slate-900 rounded-sm overflow-hidden flex flex-col">
                            <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                3.0 / Fechamento Volumétrico
                            </div>
                            <table className="w-full text-left bg-white text-sm h-full">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Volume (Litros Totais)</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-lg font-black text-slate-900">
                                            {selectedFlight.volume?.toLocaleString() || 0} <span className="text-[10px] text-slate-500 font-bold ml-1">L</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Conversão (US GAL)</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 text-xs">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * L_TO_GAL).toLocaleString() : 0} GAL
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Massa Estimada (KG)<br/><span className="text-[7px] text-slate-400">@ 0.803 DENS</span></td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 text-xs">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * AVG_DENSITY).toLocaleString() : 0} KG
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ALERTA DE ATRASO OBRIGATÓRIO */}
                    {selectedFlight.delayJustification && (
                        <div className="mb-6 border-2 border-slate-900 rounded-sm overflow-hidden flex flex-col relative print-avoid-break">
                            <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-slate-900"></div>
                            <div className="bg-slate-100 border-b border-slate-300 pl-4 py-1.5 px-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-slate-900" />
                                    JUSTIFICATIVA DE QUEBRA DE SLA (ATRASO DETECTADO)
                                </div>
                            </div>
                            <div className="bg-white pl-4 p-3 text-slate-800 text-xs font-mono border-l-2 border-transparent">
                                <b>PARECER TÉCNICO:</b> "{selectedFlight.delayJustification}"
                            </div>
                        </div>
                    )}

                    {/* OBSERVAÇÕES DE PÁTIO */}
                    {selectedFlight.report && Object.values(selectedFlight.report).some(v => v) && (
                        <div className="mb-6 border-2 border-slate-900 rounded-sm overflow-hidden print-avoid-break">
                            <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                4.0 / Anotações de Pátio e Assinaturas
                            </div>
                            <div className="p-3 bg-white grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">FUEL ORDER COLETADA</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.fuelOrderTime || '--:--'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">APRESENTAÇÃO MECÂNICA</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.mechanicTime || '--:--'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">CHEGADA DA TRIPULAÇÃO</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.crewTime || '--:--'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">TÉRMINO (ÁREA DESOBSTR.)</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.obstructedAreaTime || '--:--'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {selectedFlight.report.dispensed && (
                                <div className="border-t border-slate-300 bg-slate-100 p-2 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                                        *** DISPENSA FORMALIZADA PELO RESPONSÁVEL DO VOO ***
                                    </span>
                                </div>
                            )}
                            
                            {(selectedFlight.report.observations || selectedFlight.report.dispensed) && (
                                <div className="border-t border-slate-300 p-3 bg-white text-xs">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">OBSERVAÇÕES DO OPERADOR:</span>
                                    <p className="font-mono bg-slate-50 border border-slate-300 shadow-inner p-2 rounded-sm italic">
                                        {selectedFlight.report.dispensed && !selectedFlight.report.observations 
                                            ? \`Voo sem abastecimento solicitado por: \${selectedFlight.report.dispensedBy} (Colete \${selectedFlight.report.dispensedBadge})\`
                                            : selectedFlight.report.observations}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CAIXA PRETA / AUDITORIA */}
                    <div className="mb-6 flex-1 print-avoid-break">
                        <div className="border-b-2 border-slate-900 pb-1 mb-3 flex items-center gap-2">
                            <History size={14} className="text-slate-900" />
                            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                                5.0 / Trilha de Auditoria do Sistema (Caixa Preta)
                            </h2>
                        </div>
                        <div className="bg-white border-2 border-slate-900 rounded-sm overflow-hidden">
                           <table className="w-full text-left text-[9px] border-collapse">
                               <thead className="bg-slate-900 text-white font-black uppercase tracking-wider">
                                    <tr>
                                        <th className="px-2 py-1.5 w-[15%]">Timestamp</th>
                                        <th className="px-2 py-1.5 w-[15%]">Ação Oficial</th>
                                        <th className="px-2 py-1.5 w-[20%]">Autor / Matrícula</th>
                                        <th className="px-2 py-1.5 w-[50%] border-l border-slate-700">Descrição/Contexto Operacional</th>
                                    </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-300 font-mono font-bold text-[8px]">
                                    {selectedFlight.logs && selectedFlight.logs.length > 0 ? (
                                        selectedFlight.logs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-2 py-2 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="px-2 py-2">
                                                    <span className={\`\${log.type === 'ALERTA' || log.type === 'ATRASO' ? 'bg-slate-900 text-white px-1.5 py-0.5 rounded-sm' : 'text-slate-900'}\`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 truncate max-w-[120px] text-slate-900">{log.author}</td>
                                                <td className="px-2 py-2 text-slate-900 break-words border-l border-slate-200">{log.message}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-2 py-4 text-center text-slate-400 italic font-sans font-bold">
                                                NÃO ASSINALADO - NENHUM EVENTO REGISTRADO
                                            </td>
                                        </tr>
                                    )}
                               </tbody>
                           </table>
                        </div>
                    </div>

                    {/* ASSINATURAS E VALIDAÇÃO */}
                    <div className="mt-auto pt-8 flex justify-between items-end print-avoid-break">
                        <div className="w-[30%] border-t-2 border-slate-900 pt-2 text-center">
                            <span className="block text-[8px] font-black uppercase text-slate-900 tracking-widest">
                                ASSINATURA OPR (CÓPIA NOC)
                            </span>
                        </div>
                        <div className="w-[40%] text-center text-[7px] text-slate-500 font-mono tracking-widest font-black uppercase flex flex-col items-center">
                            <span className="mb-1 text-slate-300">| | | | | | | | | | | | | | | | | | | | | | | | | | | | | |</span>
                            <span>ID DOC: {selectedFlight.id}</span>
                            <span>HASH DE VALIDAÇÃO ELETRÔNICA DO SISTEMA</span>
                            <span>AUTENTICADOR: {btoa(selectedFlight.id).replace(/=/g, '').substring(0, 16).toUpperCase()}</span>
                        </div>
                        <div className="w-[30%] border-t-2 border-slate-900 pt-2 text-center">
                            <span className="block text-[8px] font-black uppercase text-slate-900 tracking-widest">
                                REVISÃO TÉCNICA (SUPERVISÃO)
                            </span>
                        </div>
                    </div>
\n`;

fs.writeFileSync('src/components/ReportsView.tsx', before + newContent + after);
console.log("ReportsView.tsx layout updated.");
