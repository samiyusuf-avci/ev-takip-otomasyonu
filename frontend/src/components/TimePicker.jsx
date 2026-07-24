import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown, Check, Sparkles } from 'lucide-react';

export default function TimePicker({
  value = '09:00',
  onChange,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const selectedItemRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 300 });

  // 00:00 - 23:30 arası periyotlar
  const timeOptions = useMemo(() => {
    const list = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = String(h).padStart(2, '0');
      list.push(`${hourStr}:00`);
      list.push(`${hourStr}:30`);
    }
    return list;
  }, []);

  const optionsToRender = useMemo(() => {
    if (value && !timeOptions.includes(value)) {
      return [...timeOptions, value].sort();
    }
    return timeOptions;
  }, [timeOptions, value]);

  const getTimePeriod = (timeStr) => {
    if (!timeStr) return { label: '', color: '' };
    const h = parseInt(timeStr.split(':')[0], 10);
    if (isNaN(h)) return { label: '', color: '' };
    const purpleBadgeColor = 'bg-purple-500/10 text-purple-300 border-purple-500/20';

    if (h >= 6 && h < 12) return { label: 'Sabah', color: purpleBadgeColor };
    if (h >= 12 && h < 17) return { label: 'Öğle', color: purpleBadgeColor };
    if (h >= 17 && h < 22) return { label: 'Akşam', color: purpleBadgeColor };
    return { label: 'Gece', color: purpleBadgeColor };
  };

  const updatePopoverPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width
    });
  }, []);

  // Açıldığında seçili elemanı en üste hizalayacak şekilde kaydır
  useEffect(() => {
    if (isOpen) {
      updatePopoverPos();
      window.addEventListener('resize', updatePopoverPos);
      window.addEventListener('scroll', updatePopoverPos, true);

      const timer = setTimeout(() => {
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({
            block: 'start',
            behavior: 'auto'
          });
        }
      }, 15);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePopoverPos);
        window.removeEventListener('scroll', updatePopoverPos, true);
      };
    }
  }, [isOpen, updatePopoverPos]);

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
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentPeriod = getTimePeriod(value);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full border rounded-xl py-2.5 md:py-3 px-3.5 text-xs md:text-sm transition-all flex items-center justify-between gap-2 ${
          disabled
            ? 'bg-white/[0.02] border-white/5 text-gray-400 cursor-not-allowed opacity-75 select-none'
            : isOpen
            ? 'bg-purple-900/20 border-purple-500/60 text-white ring-2 ring-purple-500/20 shadow-lg shadow-purple-950/40 cursor-pointer'
            : 'bg-white/5 border-white/10 hover:border-purple-500/40 text-white hover:bg-white/[0.07] cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
            disabled
              ? 'bg-white/5 border-white/5 text-gray-500'
              : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
          }`}>
            <Clock className="w-4 h-4" />
          </div>

          <span className={`tracking-wide text-sm md:text-base transition-colors ${
            disabled
              ? 'text-gray-400 font-medium'
              : 'text-white font-bold'
          }`}>
            {value || '09:00'}
          </span>

          {currentPeriod.label && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap hidden sm:inline-block transition-colors ${
              disabled
                ? 'bg-white/5 text-gray-500 border-white/5'
                : currentPeriod.color
            }`}>
              {currentPeriod.label}
            </span>
          )}
        </div>
        
        <ChevronDown
          className={`w-4 h-4 transition-all flex-shrink-0 ${
            disabled
              ? 'text-gray-600'
              : isOpen
              ? 'rotate-180 text-purple-400'
              : 'text-gray-400'
          }`}
        />
      </button>

      {/* Portal Dropdown Menu Always Above Other Cards */}
      {isOpen && !disabled && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            zIndex: 99999,
          }}
          className="bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Bildirim Saati Seçin
            </span>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
              TSİ (UTC+3)
            </span>
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {optionsToRender.map((t) => {
              const isSelected = value === t;
              const period = getTimePeriod(t);
              return (
                <button
                  key={t}
                  ref={isSelected ? selectedItemRef : null}
                  type="button"
                  onClick={() => {
                    onChange(t);
                    setIsOpen(false);
                  }}
                  className={`w-full py-2 px-3 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/50'
                      : 'hover:bg-white/10 text-gray-200 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="tracking-wide">{t}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'text-gray-400'
                    }`}>
                      {period.label}
                    </span>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                  )}
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
