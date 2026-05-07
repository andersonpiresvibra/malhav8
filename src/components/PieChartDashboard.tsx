import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { MeshFlight } from '../data/operationalMesh';

interface DashboardProps {
  flights: MeshFlight[];
  isDarkMode: boolean;
}

export const PieChartDashboard: React.FC<DashboardProps> = ({ flights, isDarkMode }) => {
  const data = useMemo(() => {
    let latam = 0;
    let gol = 0;
    let other = 0;
    
    let manha = 0;
    let tarde = 0;
    let noite = 0;

    const hourCounts: Record<string, number> = {};

    flights.forEach(f => {
      const code = f.airlineCode?.toUpperCase() || f.airline?.toUpperCase() || '';
      if (code.includes('LA') || code.includes('TAM')) latam++;
      else if (code.includes('G3') || code.includes('RG') || code.includes('GOL')) gol++;
      else if (code) other++;

      const etd = f.etd;
      if (etd && etd.length === 5 && etd.includes(':')) {
        const [h, m] = etd.split(':').map(Number);
        
        if (h >= 0 && h < 12) manha++;
        else if (h >= 12 && h < 18) tarde++;
        else if (h >= 18 && h <= 23) noite++;

        const hourStr = `${String(h).padStart(2, '0')}:00`;
        hourCounts[hourStr] = (hourCounts[hourStr] || 0) + 1;
      }
    });

    const airlineData = [
      { name: 'LATAM', value: latam, color: '#e8114b' },
      { name: 'GOL', value: gol, color: '#ff6b00' },
      { name: 'OUTROS', value: other, color: '#3b82f6' }
    ].filter(d => d.value > 0);

    const shiftData = [
      { name: 'MANHÃ', value: manha, color: '#f59e0b' },
      { name: 'TARDE', value: tarde, color: '#ec4899' },
      { name: 'NOITE', value: noite, color: '#6366f1' }
    ].filter(d => d.value > 0);

    const peakHoursData = Object.keys(hourCounts)
      .map(k => ({ hour: k, count: hourCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) 
      .sort((a, b) => a.hour.localeCompare(b.hour)); 

    return { airlineData, shiftData, peakHoursData, total: flights.length };
  }, [flights]);

  const textColor = isDarkMode ? '#94a3b8' : '#64748b'; 
  const bgColor = isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50';
  const borderColor = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className={`flex-1 shrink-0 border-l ${borderColor} flex flex-col h-full overflow-y-auto px-4 py-6 gap-6 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-2`}>
        DASHBOARD ESTÁTICO (RAIZ)
      </h3>

      <div className="flex flex-col gap-6">
        <div className={`flex flex-col items-center p-4 rounded-xl border object-contain ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-full text-center">Companhias Aéreas</h4>
            <div className="w-full h-40 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={data.airlineData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.airlineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 'bold' }}
                        itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
                {data.airlineData.map(a => (
                    <div key={a.name} className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }}></div>
                        <span style={{ color: textColor }}>{a.name} ({a.value})</span>
                    </div>
                ))}
            </div>
        </div>

        <div className={`flex flex-col items-center p-4 rounded-xl border object-contain ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-full text-center">Turnos</h4>
            <div className="w-full h-40 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={data.shiftData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.shiftData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 'bold' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 mt-2">
                {data.shiftData.map(a => (
                    <div key={a.name} className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }}></div>
                        <span style={{ color: textColor }}>{a.name} ({a.value})</span>
                    </div>
                ))}
            </div>
        </div>

        <div className={`flex flex-col items-center p-4 rounded-xl border object-contain ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-full text-center">Top 5: Horários de Pico</h4>
            <div className="w-full h-40 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.peakHoursData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: textColor }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: textColor }} />
                        <Tooltip 
                            cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }}
                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 'bold' }}
                            formatter={(value: any) => [`${value} voos`, 'Total']}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {data.peakHoursData.length > 0 && (
                <div className="mt-3 text-center border-t border-slate-700/20 pt-3 flex flex-col gap-1 w-full">
                    {(() => {
                        const maxPeak = [...data.peakHoursData].sort((a,b) => b.count - a.count)[0];
                        const interval = Math.max(1, Math.round(60 / (maxPeak.count || 1)));
                        return (
                            <>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                    Freq. Máxima ({maxPeak.hour})
                                </span>
                                <span className="text-xs font-bold text-emerald-500">
                                    1 voo a cada {interval} min
                                </span>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};
