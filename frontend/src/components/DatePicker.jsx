import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const TURKISH_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// YYYY-MM-DD formatlayıcı
const formatToYYYYMMDD = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Türkçe insan okuması için tarih formatı (örn: 23 Temmuz 2026)
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const match = typeof dateStr === 'string' ? dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  let year, month, day;
  if (match) {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    day = parseInt(match[3], 10);
  } else {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }
  return `${day} ${TURKISH_MONTHS[month]} ${year}`;
};

export default function DatePicker({
  value = '',
  onChange,
  required = false,
  placeholder = 'Tarih seçin...',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Akıllı pozisyon koordinatları
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 320 });

  // Mevcut seçili tarihi Date nesnesine dönüştür
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // Takvimde gösterilen yıl ve ay
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(parsedValue ? parsedValue.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedValue ? parsedValue.getMonth() : today.getMonth());

  // value değiştiğinde takvim görünümünü güncelle
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.getFullYear());
      setViewMonth(parsedValue.getMonth());
    }
  }, [parsedValue]);

  // Akıllı pozisyon hesaplama (Ekranın altındaysa yukarı açılma)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const calendarHeight = 310; // Popover yaklaşık yüksekliği
    const calendarWidth = Math.min(320, window.innerWidth - 24);

    let top = rect.bottom + 6;
    // Eğer ekranın altına sığmıyorsa yukarı aç
    if (rect.bottom + calendarHeight > window.innerHeight && rect.top > calendarHeight) {
      top = rect.top - calendarHeight - 6;
    }

    // Sınırları taşmaması için kontrol et
    top = Math.max(12, Math.min(top, window.innerHeight - calendarHeight - 12));

    let left = rect.left;
    if (left + calendarWidth > window.innerWidth - 12) {
      left = window.innerWidth - calendarWidth - 12;
    }
    left = Math.max(12, left);

    setPopoverPos({ top, left, width: calendarWidth });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Dışarı tıklamayı algıla ve pencereyi kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectDate = (dateObj) => {
    const dateStr = formatToYYYYMMDD(dateObj);
    if (onChange) {
      onChange({ target: { value: dateStr } });
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  // Ay Değiştirme
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Hızlı Kısayol Seçenekleri
  const applyShortcut = (type) => {
    const d = new Date();
    if (type === 'today') {
      // bugün
    } else if (type === '+1w') {
      d.setDate(d.getDate() + 7);
    } else if (type === '+1m') {
      d.setMonth(d.getMonth() + 1);
    } else if (type === '+1y') {
      d.setFullYear(d.getFullYear() + 1);
    }
    handleSelectDate(d);
  };

  // Gün Hücrelerini Oluştur
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Pazartesi ilk gün (0 = Pzt, 6 = Paz)
    const startingDay = (firstDay.getDay() + 6) % 7;

    const cells = [];

    // Önceki ayın günleri (dimmed)
    for (let i = startingDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push({
        day: dayNum,
        date: prevDate,
        isCurrentMonth: false,
        isPrevMonth: true
      });
    }

    // Bu ayın günleri
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(viewYear, viewMonth, i);
      cells.push({
        day: i,
        date: currDate,
        isCurrentMonth: true
      });
    }

    // Sonraki ayın günleri (tam 35 veya 42 hücre yapmak için)
    const totalSoFar = cells.length;
    const totalNeeded = totalSoFar > 35 ? 42 : 35;
    for (let i = 1; i <= totalNeeded - totalSoFar; i++) {
      const nextDate = new Date(viewYear, viewMonth + 1, i);
      cells.push({
        day: i,
        date: nextDate,
        isCurrentMonth: false,
        isNextMonth: true
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Yıl Seçenekleri Dropdown (-5 yıl, +15 yıl)
  const yearOptions = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = [];
    for (let y = currentY - 5; y <= currentY + 15; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const formattedDisplay = formatDisplayDate(value);

  return (
    <div className={`relative w-full ${className}`} ref={triggerRef}>
      {/* Gizli native input (form validation uyumluluğu için) */}
      <input
        type="text"
        required={required}
        value={value || ''}
        onChange={() => {}}
        tabIndex={-1}
        className="sr-only"
      />

      {/* İnteraktif Görsel Input Kutusu */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white/5 border rounded-xl py-2.5 px-3.5 text-sm transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 bg-white/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
            : 'border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07]'
        }`}
      >
        <span className={formattedDisplay ? 'text-white font-medium' : 'text-gray-400'}>
          {formattedDisplay || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-purple-400">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-rose-400 transition-colors"
              title="Tarihi Temizle"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <CalendarIcon className="w-4 h-4 opacity-80" />
        </div>
      </div>

      {/* React Portal ile Document Body Üzerine Çizilen Akıllı Popover */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            zIndex: 99999
          }}
          className="bg-[#161722]/95 backdrop-blur-2xl border border-purple-500/40 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] p-3.5 animate-scale-in"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-2.5 border-b border-white/10 pb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 border border-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-black/40 border border-white/10 rounded-lg py-1 px-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer"
              >
                {TURKISH_MONTHS.map((m, idx) => (
                  <option key={m} value={idx} className="bg-[#1e202d] text-white">
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-black/40 border border-white/10 rounded-lg py-1 px-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-[#1e202d] text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 border border-white/10 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Hızlı Kısayol Butonları */}
          <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 filter-tabs-scroll">
            <button
              type="button"
              onClick={() => applyShortcut('today')}
              className="px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Bugün
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('+1w')}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
            >
              +1 Hafta
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('+1m')}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
            >
              +1 Ay
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('+1y')}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
            >
              +1 Yıl
            </button>
          </div>

          {/* Haftanın Günleri İsimleri */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {TURKISH_WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-gray-400 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Günler Izgarası */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const isSelected = parsedValue &&
                parsedValue.getFullYear() === cell.date.getFullYear() &&
                parsedValue.getMonth() === cell.date.getMonth() &&
                parsedValue.getDate() === cell.date.getDate();

              const isToday =
                today.getFullYear() === cell.date.getFullYear() &&
                today.getMonth() === cell.date.getMonth() &&
                today.getDate() === cell.date.getDate();

              let cellStyle = 'text-gray-300 hover:bg-purple-600/30 hover:text-white';

              if (!cell.isCurrentMonth) {
                cellStyle = 'text-gray-600 opacity-40 hover:bg-white/5';
              }

              if (isToday && !isSelected) {
                cellStyle += ' border border-purple-400/80 text-purple-300 font-bold';
              }

              if (isSelected) {
                cellStyle = 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.6)] scale-105 rounded-lg';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDate(cell.date)}
                  className={`h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer ${cellStyle}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
