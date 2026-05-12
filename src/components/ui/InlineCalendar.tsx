import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface InlineCalendarProps {
  currentOffset: number;
  onSelectOffset: (offset: number) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const InlineCalendar: React.FC<InlineCalendarProps> = ({ currentOffset, onSelectOffset, onClose, isDarkMode }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + currentOffset);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date();
  selectedDate.setDate(selectedDate.getDate() + currentOffset);
  selectedDate.setHours(0, 0, 0, 0);

  const handleDateClick = (day: number) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    d.setHours(0, 0, 0, 0);
    const offset = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    onSelectOffset(offset);
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div ref={ref} className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 rounded-xl shadow-2xl z-[999999] border transition-colors w-64 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white shadow-black/50' : 'bg-white border-slate-200 text-slate-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button onClick={nextMonth} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center">
        {weekDays.map((d, i) => (
          <div key={i} className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          d.setHours(0,0,0,0);
          
          const isSelected = d.getTime() === selectedDate.getTime();
          const isToday = d.getTime() === today.getTime();

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`
                h-8 w-8 rounded flex items-center justify-center text-xs font-medium transition-colors
                ${isSelected 
                  ? 'bg-emerald-500 text-white font-bold shadow-sm' 
                  : isToday
                    ? (isDarkMode ? 'border border-emerald-500/50 text-emerald-400 font-bold' : 'border border-emerald-500 text-emerald-600 font-bold')
                    : (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100')
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};
